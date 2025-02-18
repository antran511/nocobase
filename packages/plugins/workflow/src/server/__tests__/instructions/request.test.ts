import { Application } from '@nocobase/server';
import Database from '@nocobase/database';
import { getApp, sleep } from '..';
import { RequestConfig } from '../../instructions/request';
import { EXECUTION_STATUS, JOB_STATUS } from '../../constants';

const PORT = 12345;

const URL_DATA = `http://localhost:${PORT}/data`;
const URL_400 = `http://localhost:${PORT}/api/400`;
const URL_TIMEOUT = `http://localhost:${PORT}/timeout`;

describe('workflow > instructions > request', () => {
  let app: Application;
  let db: Database;
  let PostRepo;
  let WorkflowModel;
  let workflow;

  beforeEach(async () => {
    app = await getApp({ manual: true });

    app.use(async (ctx, next) => {
      if (ctx.path === '/api/400') {
        return ctx.throw(400);
      }
      if (ctx.path === '/timeout') {
        await sleep(2000);
        return ctx.throw(new Error('timeout'));
      }
      if (ctx.path === '/data') {
        ctx.withoutDataWrapping = true;
        ctx.body = {
          meta: { title: ctx.query.title },
          data: { title: ctx.request.body['title'] },
        };
      }
      next();
    });

    await app.start({ listen: { port: PORT } });

    db = app.db;
    WorkflowModel = db.getCollection('workflows').model;
    PostRepo = db.getCollection('posts').repository;

    workflow = await WorkflowModel.create({
      title: 'test workflow',
      enabled: true,
      type: 'collection',
      config: {
        mode: 1,
        collection: 'posts',
      },
    });
  });

  afterEach(() => app.stop());

  describe('request', () => {
    it('request', async () => {
      await workflow.createNode({
        type: 'request',
        config: {
          url: URL_DATA,
          method: 'GET',
        } as RequestConfig,
      });

      await PostRepo.create({ values: { title: 't1' } });

      await sleep(500);

      const [execution] = await workflow.getExecutions();
      expect(execution.status).toEqual(EXECUTION_STATUS.RESOLVED);
      const [job] = await execution.getJobs();
      expect(job.status).toEqual(JOB_STATUS.RESOLVED);
    });

    it('request - timeout', async () => {
      await workflow.createNode({
        type: 'request',
        config: {
          url: URL_TIMEOUT,
          method: 'GET',
          timeout: 250,
        } as RequestConfig,
      });

      await PostRepo.create({ values: { title: 't1' } });

      await sleep(1000);

      const [execution] = await workflow.getExecutions();
      const [job] = await execution.getJobs();
      expect(job.status).toEqual(JOB_STATUS.FAILED);

      expect(job.result).toMatchObject({
        code: 'ECONNABORTED',
        name: 'AxiosError',
        status: null,
        message: 'timeout of 250ms exceeded',
      });
    });

    it('request - ignoreFail', async () => {
      await workflow.createNode({
        type: 'request',
        config: {
          url: URL_TIMEOUT,
          method: 'GET',
          timeout: 250,
          ignoreFail: true,
        } as RequestConfig,
      });

      await PostRepo.create({ values: { title: 't1' } });

      await sleep(1000);

      const [execution] = await workflow.getExecutions();
      const [job] = await execution.getJobs();
      expect(job.status).toEqual(JOB_STATUS.RESOLVED);
      expect(job.result).toMatchObject({
        code: 'ECONNABORTED',
        name: 'AxiosError',
        status: null,
        message: 'timeout of 250ms exceeded',
      });
    });

    it('response 400', async () => {
      await workflow.createNode({
        type: 'request',
        config: {
          url: URL_400,
          method: 'GET',
          ignoreFail: false,
        } as RequestConfig,
      });

      await PostRepo.create({ values: { title: 't1' } });

      await sleep(500);

      const [execution] = await workflow.getExecutions();
      const [job] = await execution.getJobs();
      expect(job.status).toEqual(JOB_STATUS.FAILED);
      expect(job.result.status).toBe(400);
    });

    it('response 400 ignoreFail', async () => {
      await workflow.createNode({
        type: 'request',
        config: {
          url: URL_400,
          method: 'GET',
          timeout: 1000,
          ignoreFail: true,
        } as RequestConfig,
      });

      await PostRepo.create({ values: { title: 't1' } });

      await sleep(500);

      const [execution] = await workflow.getExecutions();
      const [job] = await execution.getJobs();
      expect(job.status).toEqual(JOB_STATUS.RESOLVED);
      expect(job.result.status).toBe(400);
    });

    it('request with data', async () => {
      const n1 = await workflow.createNode({
        type: 'request',
        config: {
          url: URL_DATA,
          method: 'POST',
          data: { title: '{{$context.data.title}}' },
        } as RequestConfig,
      });

      await PostRepo.create({ values: { title: 't1' } });

      await sleep(500);

      const [execution] = await workflow.getExecutions();
      const [job] = await execution.getJobs();
      expect(job.status).toEqual(JOB_STATUS.RESOLVED);
      expect(job.result.data).toEqual({ title: 't1' });
    });

    // TODO(bug): should not use ejs
    it('request json data with multiple lines', async () => {
      const n1 = await workflow.createNode({
        type: 'request',
        config: {
          url: URL_DATA,
          method: 'POST',
          data: { title: '{{$context.data.title}}' },
        } as RequestConfig,
      });

      const title = 't1\n\nline 2';
      await PostRepo.create({
        values: { title },
      });

      await sleep(500);

      const [execution] = await workflow.getExecutions();
      const [job] = await execution.getJobs();
      expect(job.status).toEqual(JOB_STATUS.RESOLVED);
      expect(job.result.data).toEqual({ title });
    });
  });
});
