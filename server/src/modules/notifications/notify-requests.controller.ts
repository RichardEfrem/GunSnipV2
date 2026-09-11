import { Body, Controller, Post } from '@nestjs/common';
import type { Actor } from '@gunsnip/shared';
import { CurrentActor } from '../../common/decorators/current-actor.decorator.js';
import { CreateNotifyRequestDto } from './dto/create-notify-request.dto.js';
import type { NotifyRequestResult } from './entities/notify-request.entity.js';
import { NotifyRequestService } from './notify-request.service.js';

@Controller('notify-requests')
export class NotifyRequestsController {
  constructor(private readonly requests: NotifyRequestService) {}

  @Post()
  async create(
    @CurrentActor() actor: Actor,
    @Body() dto: CreateNotifyRequestDto,
  ): Promise<NotifyRequestResult> {
    return this.requests.register(actor, dto);
  }
}
