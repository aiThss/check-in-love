import { createApp } from './app';
import type { WorkerEnv } from './config/env';
import { runScheduledTasks } from './services/cron';

export { RealtimeHub } from './realtime/hub';

const app = createApp();

export default {
  fetch(request: Request, env: WorkerEnv, ctx: ExecutionContext): Promise<Response> {
    return Promise.resolve(app.fetch(request, env, ctx));
  },

  async scheduled(controller: ScheduledController, env: WorkerEnv, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(runScheduledTasks(env, new Date(controller.scheduledTime)));
  },
};
