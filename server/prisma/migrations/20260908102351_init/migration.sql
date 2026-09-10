-- CreateEnum
CREATE TYPE "product_type" AS ENUM ('MODEL_KIT', 'TOOL_SUPPLY');

-- CreateEnum
CREATE TYPE "product_status" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "difficulty" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT');

-- CreateEnum
CREATE TYPE "decal_type" AS ENUM ('NONE', 'STICKER', 'FOIL', 'DRY_TRANSFER', 'WATERSLIDE');

-- CreateEnum
CREATE TYPE "tool_job" AS ENUM ('CUTTING', 'SHAPING', 'PAINTING', 'ADHESIVE', 'FINISHING', 'DECAL_AIDS', 'DISPLAY', 'STORAGE', 'WORKSPACE');

-- CreateEnum
CREATE TYPE "necessity" AS ENUM ('REQUIRED', 'RECOMMENDED', 'OPTIONAL');

-- CreateEnum
CREATE TYPE "order_status" AS ENUM ('PENDING_PAYMENT', 'PAID', 'PACKING', 'SHIPPED', 'DELIVERED', 'COMPLETED', 'CANCELLED', 'EXPIRED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "payment_status" AS ENUM ('PENDING', 'PAID', 'FAILED', 'EXPIRED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "payment_method" AS ENUM ('BANK_TRANSFER', 'VIRTUAL_ACCOUNT', 'E_WALLET');

-- CreateEnum
CREATE TYPE "payment_event_type" AS ENUM ('CHARGE_CREATED', 'CHARGE_PAID', 'CHARGE_FAILED', 'CHARGE_EXPIRED', 'CHARGE_REFUNDED');

-- CreateEnum
CREATE TYPE "shipping_tier" AS ENUM ('REGULAR', 'EXPRESS', 'SAME_DAY');

-- CreateEnum
CREATE TYPE "shipping_zone" AS ENUM ('JABODETABEK', 'JAVA', 'BALI_NUSA', 'SUMATRA', 'KALIMANTAN', 'SULAWESI', 'MALUKU_PAPUA');

-- CreateEnum
CREATE TYPE "voucher_type" AS ENUM ('PERCENTAGE', 'FIXED_AMOUNT', 'FREE_SHIPPING');

-- CreateEnum
CREATE TYPE "review_status" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "inventory_movement_reason" AS ENUM ('RESTOCK', 'CORRECTION', 'DAMAGE', 'LOSS', 'RETURN', 'ORDER_FULFILLED');

-- CreateEnum
CREATE TYPE "actor_kind" AS ENUM ('GUEST', 'USER', 'ADMIN', 'SYSTEM');

-- CreateEnum
CREATE TYPE "address_region_level" AS ENUM ('PROVINCE', 'CITY', 'DISTRICT');

-- CreateEnum
CREATE TYPE "role" AS ENUM ('ADMIN', 'STAFF', 'CUSTOMER');

-- CreateTable
CREATE TABLE "brand" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "brand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grade" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "grade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scale" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "scale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "series" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "series_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "category" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "type" "product_type" NOT NULL,
    "parent_id" UUID,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "address_region" (
    "id" UUID NOT NULL,
    "level" "address_region_level" NOT NULL,
    "name" TEXT NOT NULL,
    "parent_id" UUID,
    "shipping_zone" "shipping_zone",
    "postal_code" TEXT,

    CONSTRAINT "address_region_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "search_synonym" (
    "id" UUID NOT NULL,
    "term" TEXT NOT NULL,
    "expansions" TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "search_synonym_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product" (
    "id" UUID NOT NULL,
    "type" "product_type" NOT NULL,
    "status" "product_status" NOT NULL DEFAULT 'DRAFT',
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "brand_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "grade_id" UUID,
    "scale_id" UUID,
    "series_id" UUID,
    "unit_name" TEXT,
    "unit_code" TEXT,
    "runner_count" INTEGER,
    "part_count" INTEGER,
    "difficulty" "difficulty",
    "decal_type" "decal_type",
    "articulation_notes" TEXT,
    "includes" TEXT[],
    "release_year" INTEGER,
    "runtime_minutes_est" INTEGER,
    "tool_job" "tool_job",
    "attributes" JSONB NOT NULL DEFAULT '{}',
    "tags" TEXT[],
    "search_vector" tsvector,
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_variant" (
    "id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "sku" TEXT NOT NULL,
    "name" TEXT,
    "option_values" JSONB NOT NULL DEFAULT '{}',
    "price_idr" INTEGER NOT NULL,
    "compare_at_price_idr" INTEGER,
    "stock_on_hand" INTEGER NOT NULL DEFAULT 0,
    "stock_reserved" INTEGER NOT NULL DEFAULT 0,
    "weight_grams" INTEGER NOT NULL DEFAULT 0,
    "barcode" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "is_archived" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_variant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_image" (
    "id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "url" TEXT NOT NULL,
    "alt" TEXT NOT NULL,
    "blur_data_url" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "product_image_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_requirement" (
    "id" UUID NOT NULL,
    "kit_product_id" UUID NOT NULL,
    "tool_product_id" UUID NOT NULL,
    "necessity" "necessity" NOT NULL,
    "reason" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "product_requirement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grade_tool_default" (
    "id" UUID NOT NULL,
    "grade_id" UUID NOT NULL,
    "tool_product_id" UUID NOT NULL,
    "necessity" "necessity" NOT NULL,
    "reason" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "grade_tool_default_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cart" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "user_id" UUID,
    "voucher_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cart_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cart_item" (
    "id" UUID NOT NULL,
    "cart_id" UUID NOT NULL,
    "variant_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "is_selected" BOOLEAN NOT NULL DEFAULT true,
    "price_at_add_idr" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cart_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order" (
    "id" UUID NOT NULL,
    "order_number" TEXT NOT NULL,
    "session_id" UUID NOT NULL,
    "user_id" UUID,
    "status" "order_status" NOT NULL DEFAULT 'PENDING_PAYMENT',
    "customer_snapshot" JSONB NOT NULL,
    "shipping_region_id" UUID,
    "shipping_tier" "shipping_tier" NOT NULL,
    "subtotal_idr" INTEGER NOT NULL,
    "discount_idr" INTEGER NOT NULL DEFAULT 0,
    "shipping_idr" INTEGER NOT NULL,
    "total_idr" INTEGER NOT NULL,
    "customer_note" TEXT,
    "internal_note" TEXT,
    "cancel_reason" TEXT,
    "placed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paid_at" TIMESTAMP(3),
    "delivered_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_item" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "variant_id" UUID,
    "product_name_snapshot" TEXT NOT NULL,
    "variant_name_snapshot" TEXT,
    "sku_snapshot" TEXT NOT NULL,
    "image_url_snapshot" TEXT,
    "product_slug_snapshot" TEXT NOT NULL,
    "unit_price_idr" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "line_total_idr" INTEGER NOT NULL,

    CONSTRAINT "order_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_event" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "from_status" "order_status",
    "to_status" "order_status" NOT NULL,
    "actor_kind" "actor_kind" NOT NULL,
    "actor_id" TEXT,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "method" "payment_method" NOT NULL,
    "status" "payment_status" NOT NULL DEFAULT 'PENDING',
    "amount_idr" INTEGER NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "provider_ref" TEXT,
    "instructions" JSONB,
    "paid_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_event" (
    "id" UUID NOT NULL,
    "payment_id" UUID NOT NULL,
    "type" "payment_event_type" NOT NULL,
    "payload" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipment" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "courier" TEXT NOT NULL,
    "tracking_number" TEXT,
    "estimated_days" INTEGER NOT NULL,
    "shipped_at" TIMESTAMP(3),
    "delivered_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipping_rate" (
    "id" UUID NOT NULL,
    "zone" "shipping_zone" NOT NULL,
    "tier" "shipping_tier" NOT NULL,
    "price_idr" INTEGER NOT NULL,
    "min_days" INTEGER NOT NULL,
    "max_days" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "shipping_rate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "idempotency_key" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "session_id" UUID NOT NULL,
    "request_hash" TEXT NOT NULL,
    "order_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "idempotency_key_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_movement" (
    "id" UUID NOT NULL,
    "variant_id" UUID NOT NULL,
    "delta" INTEGER NOT NULL,
    "reason" "inventory_movement_reason" NOT NULL,
    "note" TEXT,
    "actor_kind" "actor_kind" NOT NULL,
    "actor_id" TEXT,
    "order_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_movement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "voucher" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "type" "voucher_type" NOT NULL,
    "percent_off" INTEGER,
    "amount_idr" INTEGER,
    "min_spend_idr" INTEGER,
    "max_discount_idr" INTEGER,
    "starts_at" TIMESTAMP(3) NOT NULL,
    "ends_at" TIMESTAMP(3) NOT NULL,
    "usage_limit" INTEGER,
    "per_session_limit" INTEGER,
    "used_count" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "voucher_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "voucher_redemption" (
    "id" UUID NOT NULL,
    "voucher_id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "user_id" UUID,
    "amount_idr" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "voucher_redemption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review" (
    "id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "order_item_id" UUID,
    "session_id" UUID NOT NULL,
    "user_id" UUID,
    "author_name" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" "review_status" NOT NULL DEFAULT 'PENDING',
    "is_verified_purchase" BOOLEAN NOT NULL DEFAULT false,
    "build_time_minutes" INTEGER,
    "experienced_difficulty" "difficulty",
    "tools_used" TEXT[],
    "admin_reply" TEXT,
    "moderated_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_photo" (
    "id" UUID NOT NULL,
    "review_id" UUID NOT NULL,
    "url" TEXT NOT NULL,
    "alt" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "review_photo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_invite" (
    "id" UUID NOT NULL,
    "order_item_id" UUID NOT NULL,
    "token" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "review_invite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notify_request" (
    "id" UUID NOT NULL,
    "variant_id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "session_id" UUID NOT NULL,
    "user_id" UUID,
    "notified_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notify_request_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bundle" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "price_idr" INTEGER NOT NULL,
    "starts_at" TIMESTAMP(3),
    "ends_at" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bundle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bundle_item" (
    "id" UUID NOT NULL,
    "bundle_id" UUID NOT NULL,
    "variant_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "bundle_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "banner" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "image_url" TEXT NOT NULL,
    "alt" TEXT NOT NULL,
    "href" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "starts_at" TIMESTAMP(3),
    "ends_at" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "banner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_VoucherCategories" (
    "A" UUID NOT NULL,
    "B" UUID NOT NULL,

    CONSTRAINT "_VoucherCategories_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_VoucherProducts" (
    "A" UUID NOT NULL,
    "B" UUID NOT NULL,

    CONSTRAINT "_VoucherProducts_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "brand_slug_key" ON "brand"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "grade_code_key" ON "grade"("code");

-- CreateIndex
CREATE UNIQUE INDEX "scale_code_key" ON "scale"("code");

-- CreateIndex
CREATE UNIQUE INDEX "series_slug_key" ON "series"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "category_slug_key" ON "category"("slug");

-- CreateIndex
CREATE INDEX "category_parent_id_idx" ON "category"("parent_id");

-- CreateIndex
CREATE INDEX "category_type_position_idx" ON "category"("type", "position");

-- CreateIndex
CREATE INDEX "address_region_level_name_idx" ON "address_region"("level", "name");

-- CreateIndex
CREATE UNIQUE INDEX "address_region_parent_id_name_key" ON "address_region"("parent_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "search_synonym_term_key" ON "search_synonym"("term");

-- CreateIndex
CREATE UNIQUE INDEX "product_slug_key" ON "product"("slug");

-- CreateIndex
CREATE INDEX "product_type_status_idx" ON "product"("type", "status");

-- CreateIndex
CREATE INDEX "product_grade_id_scale_id_idx" ON "product"("grade_id", "scale_id");

-- CreateIndex
CREATE INDEX "product_attributes_idx" ON "product" USING GIN ("attributes");

-- CreateIndex
CREATE INDEX "product_category_id_status_idx" ON "product"("category_id", "status");

-- CreateIndex
CREATE INDEX "product_brand_id_idx" ON "product"("brand_id");

-- CreateIndex
CREATE INDEX "product_series_id_idx" ON "product"("series_id");

-- CreateIndex
CREATE INDEX "product_unit_code_idx" ON "product"("unit_code");

-- CreateIndex
CREATE INDEX "product_published_at_idx" ON "product"("published_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "product_variant_sku_key" ON "product_variant"("sku");

-- CreateIndex
CREATE INDEX "product_variant_product_id_position_idx" ON "product_variant"("product_id", "position");

-- CreateIndex
CREATE INDEX "product_image_product_id_position_idx" ON "product_image"("product_id", "position");

-- CreateIndex
CREATE INDEX "product_requirement_tool_product_id_idx" ON "product_requirement"("tool_product_id");

-- CreateIndex
CREATE UNIQUE INDEX "product_requirement_kit_product_id_tool_product_id_key" ON "product_requirement"("kit_product_id", "tool_product_id");

-- CreateIndex
CREATE UNIQUE INDEX "grade_tool_default_grade_id_tool_product_id_key" ON "grade_tool_default"("grade_id", "tool_product_id");

-- CreateIndex
CREATE INDEX "cart_session_id_idx" ON "cart"("session_id");

-- CreateIndex
CREATE INDEX "cart_user_id_idx" ON "cart"("user_id");

-- CreateIndex
CREATE INDEX "cart_item_variant_id_idx" ON "cart_item"("variant_id");

-- CreateIndex
CREATE UNIQUE INDEX "cart_item_cart_id_variant_id_key" ON "cart_item"("cart_id", "variant_id");

-- CreateIndex
CREATE UNIQUE INDEX "order_order_number_key" ON "order"("order_number");

-- CreateIndex
CREATE INDEX "order_session_id_idx" ON "order"("session_id");

-- CreateIndex
CREATE INDEX "order_user_id_idx" ON "order"("user_id");

-- CreateIndex
CREATE INDEX "order_status_placed_at_idx" ON "order"("status", "placed_at" DESC);

-- CreateIndex
CREATE INDEX "order_item_order_id_idx" ON "order_item"("order_id");

-- CreateIndex
CREATE INDEX "order_item_variant_id_idx" ON "order_item"("variant_id");

-- CreateIndex
CREATE INDEX "order_event_order_id_created_at_idx" ON "order_event"("order_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "payment_order_id_key" ON "payment"("order_id");

-- CreateIndex
CREATE INDEX "payment_status_expires_at_idx" ON "payment"("status", "expires_at");

-- CreateIndex
CREATE INDEX "payment_event_payment_id_created_at_idx" ON "payment_event"("payment_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "shipment_order_id_key" ON "shipment"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "shipping_rate_zone_tier_key" ON "shipping_rate"("zone", "tier");

-- CreateIndex
CREATE INDEX "idempotency_key_expires_at_idx" ON "idempotency_key"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "idempotency_key_scope_key_key" ON "idempotency_key"("scope", "key");

-- CreateIndex
CREATE INDEX "inventory_movement_variant_id_created_at_idx" ON "inventory_movement"("variant_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "voucher_code_key" ON "voucher"("code");

-- CreateIndex
CREATE INDEX "voucher_is_active_starts_at_ends_at_idx" ON "voucher"("is_active", "starts_at", "ends_at");

-- CreateIndex
CREATE UNIQUE INDEX "voucher_redemption_order_id_key" ON "voucher_redemption"("order_id");

-- CreateIndex
CREATE INDEX "voucher_redemption_voucher_id_session_id_idx" ON "voucher_redemption"("voucher_id", "session_id");

-- CreateIndex
CREATE UNIQUE INDEX "review_order_item_id_key" ON "review"("order_item_id");

-- CreateIndex
CREATE INDEX "review_product_id_status_created_at_idx" ON "review"("product_id", "status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "review_status_idx" ON "review"("status");

-- CreateIndex
CREATE INDEX "review_photo_review_id_position_idx" ON "review_photo"("review_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "review_invite_token_key" ON "review_invite"("token");

-- CreateIndex
CREATE INDEX "review_invite_order_item_id_idx" ON "review_invite"("order_item_id");

-- CreateIndex
CREATE INDEX "notify_request_variant_id_notified_at_idx" ON "notify_request"("variant_id", "notified_at");

-- CreateIndex
CREATE UNIQUE INDEX "notify_request_variant_id_email_key" ON "notify_request"("variant_id", "email");

-- CreateIndex
CREATE UNIQUE INDEX "bundle_slug_key" ON "bundle"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "bundle_item_bundle_id_variant_id_key" ON "bundle_item"("bundle_id", "variant_id");

-- CreateIndex
CREATE INDEX "banner_is_active_position_idx" ON "banner"("is_active", "position");

-- CreateIndex
CREATE INDEX "_VoucherCategories_B_index" ON "_VoucherCategories"("B");

-- CreateIndex
CREATE INDEX "_VoucherProducts_B_index" ON "_VoucherProducts"("B");

-- AddForeignKey
ALTER TABLE "category" ADD CONSTRAINT "category_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "address_region" ADD CONSTRAINT "address_region_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "address_region"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product" ADD CONSTRAINT "product_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brand"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product" ADD CONSTRAINT "product_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product" ADD CONSTRAINT "product_grade_id_fkey" FOREIGN KEY ("grade_id") REFERENCES "grade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product" ADD CONSTRAINT "product_scale_id_fkey" FOREIGN KEY ("scale_id") REFERENCES "scale"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product" ADD CONSTRAINT "product_series_id_fkey" FOREIGN KEY ("series_id") REFERENCES "series"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_variant" ADD CONSTRAINT "product_variant_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_image" ADD CONSTRAINT "product_image_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_requirement" ADD CONSTRAINT "product_requirement_kit_product_id_fkey" FOREIGN KEY ("kit_product_id") REFERENCES "product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_requirement" ADD CONSTRAINT "product_requirement_tool_product_id_fkey" FOREIGN KEY ("tool_product_id") REFERENCES "product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grade_tool_default" ADD CONSTRAINT "grade_tool_default_grade_id_fkey" FOREIGN KEY ("grade_id") REFERENCES "grade"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grade_tool_default" ADD CONSTRAINT "grade_tool_default_tool_product_id_fkey" FOREIGN KEY ("tool_product_id") REFERENCES "product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart" ADD CONSTRAINT "cart_voucher_id_fkey" FOREIGN KEY ("voucher_id") REFERENCES "voucher"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_item" ADD CONSTRAINT "cart_item_cart_id_fkey" FOREIGN KEY ("cart_id") REFERENCES "cart"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_item" ADD CONSTRAINT "cart_item_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order" ADD CONSTRAINT "order_shipping_region_id_fkey" FOREIGN KEY ("shipping_region_id") REFERENCES "address_region"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_item" ADD CONSTRAINT "order_item_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_item" ADD CONSTRAINT "order_item_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_event" ADD CONSTRAINT "order_event_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment" ADD CONSTRAINT "payment_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_event" ADD CONSTRAINT "payment_event_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipment" ADD CONSTRAINT "shipment_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "idempotency_key" ADD CONSTRAINT "idempotency_key_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movement" ADD CONSTRAINT "inventory_movement_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voucher_redemption" ADD CONSTRAINT "voucher_redemption_voucher_id_fkey" FOREIGN KEY ("voucher_id") REFERENCES "voucher"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voucher_redemption" ADD CONSTRAINT "voucher_redemption_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review" ADD CONSTRAINT "review_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review" ADD CONSTRAINT "review_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "order_item"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_photo" ADD CONSTRAINT "review_photo_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "review"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_invite" ADD CONSTRAINT "review_invite_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "order_item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notify_request" ADD CONSTRAINT "notify_request_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bundle_item" ADD CONSTRAINT "bundle_item_bundle_id_fkey" FOREIGN KEY ("bundle_id") REFERENCES "bundle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bundle_item" ADD CONSTRAINT "bundle_item_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_VoucherCategories" ADD CONSTRAINT "_VoucherCategories_A_fkey" FOREIGN KEY ("A") REFERENCES "category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_VoucherCategories" ADD CONSTRAINT "_VoucherCategories_B_fkey" FOREIGN KEY ("B") REFERENCES "voucher"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_VoucherProducts" ADD CONSTRAINT "_VoucherProducts_A_fkey" FOREIGN KEY ("A") REFERENCES "product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_VoucherProducts" ADD CONSTRAINT "_VoucherProducts_B_fkey" FOREIGN KEY ("B") REFERENCES "voucher"("id") ON DELETE CASCADE ON UPDATE CASCADE;
