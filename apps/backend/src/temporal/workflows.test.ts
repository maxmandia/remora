import { randomUUID } from 'node:crypto'
import { createRequire } from 'node:module'

import { TestWorkflowEnvironment } from '@temporalio/testing'
import { Worker } from '@temporalio/worker'
import { describe, expect, it } from 'vitest'

import * as activities from './activities.ts'
import {
  temporalSkeletonActivityType,
  temporalSkeletonWorkflowType,
} from './types.ts'
import { temporalSkeletonWorkflow } from './workflows.ts'

const require = createRequire(import.meta.url)

describe('temporal skeleton workflow', () => {
  it('runs through the Temporal test environment', async () => {
    const testEnv = await TestWorkflowEnvironment.createLocal()
    const taskQueue = `temporal-skeleton-${randomUUID()}`

    try {
      const worker = await Worker.create({
        connection: testEnv.nativeConnection,
        namespace: testEnv.namespace,
        taskQueue,
        workflowsPath: require.resolve('./workflows.ts'),
        activities,
      })

      const result = await worker.runUntil(
        testEnv.client.workflow.execute(temporalSkeletonWorkflow, {
          workflowId: `temporal-skeleton-${randomUUID()}`,
          taskQueue,
          args: [{ note: 'test' }],
        }),
      )

      expect(result).toEqual({
        ok: true,
        workflow: temporalSkeletonWorkflowType,
        activity: {
          ok: true,
          activity: temporalSkeletonActivityType,
        },
        note: 'test',
      })
    } finally {
      await testEnv.teardown()
    }
  }, 60_000)
})
