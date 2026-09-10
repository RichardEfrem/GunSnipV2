-- Full-text and fuzzy search infrastructure (FR-SRCH-01…04).
--
-- None of this is expressible in schema.prisma: Prisma has no tsvector type, no trigger
-- support, and no operator classes for the trigram indexes. It lives in a migration so the
-- shadow database replays it too and `migrate dev` never reports drift.

-- Trusted extension since PG13, so the app role can install it without superuser.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ---------------------------------------------------------------------------------------
-- The search vector.
--
-- A trigger rather than a GENERATED column, because the vector has to include the brand and
-- series *names*, which live in other tables — a generated column may only reference its own
-- row. Weights, most specific first:
--
--   A  product name and unit code   'RX-78-2' is the highest-signal thing anyone types
--   B  unit name                    "RX-78-2 Gundam"
--   C  series and brand             narrows, but matches thousands of rows on its own
--   D  tags                         editorial, lowest confidence
--
-- 'english' everywhere except the unit code, which is 'simple': stemming a part number is
-- never right, and 'english' would happily turn a suffix into something else.
CREATE OR REPLACE FUNCTION product_search_vector_refresh() RETURNS trigger AS $$
DECLARE
  v_series_name text;
  v_brand_name  text;
BEGIN
  SELECT name INTO v_series_name FROM series WHERE id = NEW.series_id;
  SELECT name INTO v_brand_name  FROM brand  WHERE id = NEW.brand_id;

  NEW.search_vector :=
       setweight(to_tsvector('english', coalesce(NEW.name, '')), 'A')
    || setweight(to_tsvector('simple',  coalesce(NEW.unit_code, '')), 'A')
    || setweight(to_tsvector('english', coalesce(NEW.unit_name, '')), 'B')
    || setweight(to_tsvector('english', coalesce(v_series_name, '')), 'C')
    || setweight(to_tsvector('english', coalesce(v_brand_name, '')), 'C')
    || setweight(to_tsvector('english', coalesce(array_to_string(NEW.tags, ' '), '')), 'D');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Fires on *any* product update, not `UPDATE OF <the six source columns>`.
--
-- The narrower form looks like a free optimisation and is a trap: the reindex triggers below
-- touch `updated_at` to force a refresh, which a column list would not match, so a brand
-- rename would silently fail to reindex. Product rows are edited by an operator a handful of
-- times a day, so recomputing a tsvector on each one costs nothing worth having.
CREATE TRIGGER product_search_vector_trigger
  BEFORE INSERT OR UPDATE
  ON product
  FOR EACH ROW
  EXECUTE FUNCTION product_search_vector_refresh();

-- Reference data is operator-editable (FR-ADM-09), and the vector holds a denormalised copy
-- of these two names. Without this, renaming a brand leaves every one of its products
-- findable only under the old name — a bug that would surface months later as "search is
-- broken" with no obvious cause. The no-op UPDATE re-fires the trigger above rather than
-- duplicating its expression here.
CREATE OR REPLACE FUNCTION product_search_reindex_by_brand() RETURNS trigger AS $$
BEGIN
  UPDATE product SET updated_at = now() WHERE brand_id = NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION product_search_reindex_by_series() RETURNS trigger AS $$
BEGIN
  UPDATE product SET updated_at = now() WHERE series_id = NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER brand_rename_reindex_trigger
  AFTER UPDATE OF name ON brand
  FOR EACH ROW
  WHEN (OLD.name IS DISTINCT FROM NEW.name)
  EXECUTE FUNCTION product_search_reindex_by_brand();

CREATE TRIGGER series_rename_reindex_trigger
  AFTER UPDATE OF name ON series
  FOR EACH ROW
  WHEN (OLD.name IS DISTINCT FROM NEW.name)
  EXECUTE FUNCTION product_search_reindex_by_series();

-- ---------------------------------------------------------------------------------------
-- Indexes.

CREATE INDEX product_search_vector_idx ON product USING GIN (search_vector);

-- The similarity fallback for when FTS returns nothing — "barbatso" has to find Barbatos
-- (FR-SRCH DoD §13.2). Trigram GIN on exactly the three fields a misspelling lands in.
CREATE INDEX product_name_trgm_idx      ON product USING GIN (name gin_trgm_ops);
CREATE INDEX product_unit_name_trgm_idx ON product USING GIN (unit_name gin_trgm_ops);
CREATE INDEX product_unit_code_trgm_idx ON product USING GIN (unit_code gin_trgm_ops);

-- Synonyms are looked up by the typed term on every search (FR-SRCH-04).
CREATE INDEX search_synonym_term_trgm_idx ON search_synonym USING GIN (term gin_trgm_ops);
