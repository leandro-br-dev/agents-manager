import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest'
import request from 'supertest'
import express, { Express } from 'express'
import { db } from '../db/index.js'
import plansRouter from './plans.js'

// Mock authentication middleware
vi.mock('../middleware/auth.js', () => ({
  authenticateToken: (req: any, res: any, next: any) => {
    req.headers['authorization'] = 'Bearer test-token'
    next()
  },
}))

describe('Plans API', () => {
  let app: Express

  beforeAll(() => {
    // Create a test Express app
    app = express()
    app.use(express.json())
    app.use('/api/plans', plansRouter)
  })

  beforeEach(() => {
    // Clear tables before each test
    db.exec('DELETE FROM plan_logs')
    db.exec('DELETE FROM plans')
  })

  afterEach(() => {
    // Clean up after each test
    db.exec('DELETE FROM plan_logs')
    db.exec('DELETE FROM plans')
  })

  describe('POST /api/plans', () => {
    it('should create a new plan', async () => {
      const response = await request(app)
        .post('/api/plans')
        .send({
          name: 'Test Plan',
          tasks: 'Task 1\nTask 2\nTask 3',
        })
        .expect(201)

      expect(response.body.error).toBeNull()
      expect(response.body.data).toHaveProperty('id')
      expect(response.body.data.name).toBe('Test Plan')
      expect(response.body.data.tasks).toBe('Task 1\nTask 2\nTask 3')
      expect(response.body.data.status).toBe('pending')
      expect(response.body.data).toHaveProperty('created_at')
    })

    it('should return 400 if name is missing', async () => {
      const response = await request(app)
        .post('/api/plans')
        .send({
          tasks: 'Task 1',
        })
        .expect(400)

      expect(response.body.data).toBeNull()
      expect(response.body.error).toBe('name and tasks are required')
    })

    it('should return 400 if tasks is missing', async () => {
      const response = await request(app)
        .post('/api/plans')
        .send({
          name: 'Test Plan',
        })
        .expect(400)

      expect(response.body.data).toBeNull()
      expect(response.body.error).toBe('name and tasks are required')
    })
  })

  describe('GET /api/plans', () => {
    it('should return empty array when no plans exist', async () => {
      const response = await request(app)
        .get('/api/plans')
        .expect(200)

      expect(response.body.error).toBeNull()
      expect(response.body.data).toEqual([])
    })

    it('should return all plans ordered by created_at DESC', async () => {
      // Create three plans
      await request(app)
        .post('/api/plans')
        .send({ name: 'Plan 1', tasks: 'Task 1' })

      await new Promise(resolve => setTimeout(resolve, 10)) // Small delay to ensure different timestamps

      await request(app)
        .post('/api/plans')
        .send({ name: 'Plan 2', tasks: 'Task 2' })

      await new Promise(resolve => setTimeout(resolve, 10))

      await request(app)
        .post('/api/plans')
        .send({ name: 'Plan 3', tasks: 'Task 3' })

      const response = await request(app)
        .get('/api/plans')
        .expect(200)

      expect(response.body.error).toBeNull()
      expect(response.body.data).toHaveLength(3)
      expect(response.body.data[0].name).toBe('Plan 3') // Most recent first
      expect(response.body.data[1].name).toBe('Plan 2')
      expect(response.body.data[2].name).toBe('Plan 1')
    })
  })

  describe('GET /api/plans/pending', () => {
    it('should return only pending plans', async () => {
      // Create a pending plan
      const pendingResponse = await request(app)
        .post('/api/plans')
        .send({ name: 'Pending Plan', tasks: 'Task 1' })

      const planId = pendingResponse.body.data.id

      // Create another plan and mark it as running
      const runningResponse = await request(app)
        .post('/api/plans')
        .send({ name: 'Running Plan', tasks: 'Task 2' })

      await request(app)
        .post(`/api/plans/${runningResponse.body.data.id}/start`)
        .send({ client_id: 'client-123' })

      const response = await request(app)
        .get('/api/plans/pending')
        .expect(200)

      expect(response.body.error).toBeNull()
      expect(response.body.data).toHaveLength(1)
      expect(response.body.data[0].id).toBe(planId)
      expect(response.body.data[0].status).toBe('pending')
    })

    it('should return empty array when no pending plans exist', async () => {
      // Create a plan and mark it as running
      const createResponse = await request(app)
        .post('/api/plans')
        .send({ name: 'Test Plan', tasks: 'Task 1' })

      await request(app)
        .post(`/api/plans/${createResponse.body.data.id}/start`)
        .send({ client_id: 'client-123' })

      const response = await request(app)
        .get('/api/plans/pending')
        .expect(200)

      expect(response.body.error).toBeNull()
      expect(response.body.data).toEqual([])
    })
  })

  describe('GET /api/plans/:id', () => {
    it('should return plan details with log count', async () => {
      const createResponse = await request(app)
        .post('/api/plans')
        .send({ name: 'Test Plan', tasks: 'Task 1' })

      const planId = createResponse.body.data.id

      // Add some logs
      await request(app)
        .post(`/api/plans/${planId}/logs`)
        .send([
          { task_id: 'task-1', level: 'info', message: 'Starting task' },
          { task_id: 'task-1', level: 'info', message: 'Completed task' },
        ])

      const response = await request(app)
        .get(`/api/plans/${planId}`)
        .expect(200)

      expect(response.body.error).toBeNull()
      expect(response.body.data.id).toBe(planId)
      expect(response.body.data.name).toBe('Test Plan')
      expect(response.body.data.log_count).toBe(2)
    })

    it('should return 404 for non-existent plan', async () => {
      const response = await request(app)
        .get('/api/plans/non-existent-id')
        .expect(404)

      expect(response.body.data).toBeNull()
      expect(response.body.error).toBe('Plan not found')
    })
  })

  describe('POST /api/plans/:id/start', () => {
    it('should start a pending plan', async () => {
      const createResponse = await request(app)
        .post('/api/plans')
        .send({ name: 'Test Plan', tasks: 'Task 1' })

      const planId = createResponse.body.data.id

      const response = await request(app)
        .post(`/api/plans/${planId}/start`)
        .send({ client_id: 'client-123' })
        .expect(200)

      expect(response.body.error).toBeNull()
      expect(response.body.data.status).toBe('running')
      expect(response.body.data.client_id).toBe('client-123')
      expect(response.body.data).toHaveProperty('started_at')
    })

    it('should return 400 if client_id is missing', async () => {
      const createResponse = await request(app)
        .post('/api/plans')
        .send({ name: 'Test Plan', tasks: 'Task 1' })

      const planId = createResponse.body.data.id

      const response = await request(app)
        .post(`/api/plans/${planId}/start`)
        .send({})
        .expect(400)

      expect(response.body.data).toBeNull()
      expect(response.body.error).toBe('client_id is required')
    })

    it('should return 400 if plan is not pending', async () => {
      const createResponse = await request(app)
        .post('/api/plans')
        .send({ name: 'Test Plan', tasks: 'Task 1' })

      const planId = createResponse.body.data.id

      // Start the plan
      await request(app)
        .post(`/api/plans/${planId}/start`)
        .send({ client_id: 'client-123' })

      // Try to start it again
      const response = await request(app)
        .post(`/api/plans/${planId}/start`)
        .send({ client_id: 'client-123' })
        .expect(400)

      expect(response.body.data).toBeNull()
      expect(response.body.error).toBe('Plan is not in pending status')
    })

    it('should return 404 for non-existent plan', async () => {
      const response = await request(app)
        .post('/api/plans/non-existent-id/start')
        .send({ client_id: 'client-123' })
        .expect(404)

      expect(response.body.data).toBeNull()
      expect(response.body.error).toBe('Plan not found')
    })
  })

  describe('POST /api/plans/:id/complete', () => {
    it('should complete a running plan with success', async () => {
      const createResponse = await request(app)
        .post('/api/plans')
        .send({ name: 'Test Plan', tasks: 'Task 1' })

      const planId = createResponse.body.data.id

      // Start the plan
      await request(app)
        .post(`/api/plans/${planId}/start`)
        .send({ client_id: 'client-123' })

      // Complete the plan
      const response = await request(app)
        .post(`/api/plans/${planId}/complete`)
        .send({
          status: 'success',
          result: 'All tasks completed successfully',
        })
        .expect(200)

      expect(response.body.error).toBeNull()
      expect(response.body.data.status).toBe('success')
      expect(response.body.data.result).toBe('All tasks completed successfully')
      expect(response.body.data).toHaveProperty('completed_at')
    })

    it('should complete a running plan with failure', async () => {
      const createResponse = await request(app)
        .post('/api/plans')
        .send({ name: 'Test Plan', tasks: 'Task 1' })

      const planId = createResponse.body.data.id

      // Start the plan
      await request(app)
        .post(`/api/plans/${planId}/start`)
        .send({ client_id: 'client-123' })

      // Complete the plan with failure
      const response = await request(app)
        .post(`/api/plans/${planId}/complete`)
        .send({
          status: 'failed',
          result: 'Task failed with error',
        })
        .expect(200)

      expect(response.body.error).toBeNull()
      expect(response.body.data.status).toBe('failed')
      expect(response.body.data.result).toBe('Task failed with error')
      expect(response.body.data).toHaveProperty('completed_at')
    })

    it('should return 400 if status is missing', async () => {
      const createResponse = await request(app)
        .post('/api/plans')
        .send({ name: 'Test Plan', tasks: 'Task 1' })

      const planId = createResponse.body.data.id

      // Start the plan
      await request(app)
        .post(`/api/plans/${planId}/start`)
        .send({ client_id: 'client-123' })

      const response = await request(app)
        .post(`/api/plans/${planId}/complete`)
        .send({ result: 'Some result' })
        .expect(400)

      expect(response.body.data).toBeNull()
      expect(response.body.error).toBe('status and result are required')
    })

    it('should return 400 if result is missing', async () => {
      const createResponse = await request(app)
        .post('/api/plans')
        .send({ name: 'Test Plan', tasks: 'Task 1' })

      const planId = createResponse.body.data.id

      // Start the plan
      await request(app)
        .post(`/api/plans/${planId}/start`)
        .send({ client_id: 'client-123' })

      const response = await request(app)
        .post(`/api/plans/${planId}/complete`)
        .send({ status: 'success' })
        .expect(400)

      expect(response.body.data).toBeNull()
      expect(response.body.error).toBe('status and result are required')
    })

    it('should return 400 if status is invalid', async () => {
      const createResponse = await request(app)
        .post('/api/plans')
        .send({ name: 'Test Plan', tasks: 'Task 1' })

      const planId = createResponse.body.data.id

      // Start the plan
      await request(app)
        .post(`/api/plans/${planId}/start`)
        .send({ client_id: 'client-123' })

      const response = await request(app)
        .post(`/api/plans/${planId}/complete`)
        .send({
          status: 'invalid',
          result: 'Some result',
        })
        .expect(400)

      expect(response.body.data).toBeNull()
      expect(response.body.error).toBe('status must be success or failed')
    })

    it('should return 400 if plan is not running', async () => {
      const createResponse = await request(app)
        .post('/api/plans')
        .send({ name: 'Test Plan', tasks: 'Task 1' })

      const planId = createResponse.body.data.id

      const response = await request(app)
        .post(`/api/plans/${planId}/complete`)
        .send({
          status: 'success',
          result: 'Completed',
        })
        .expect(400)

      expect(response.body.data).toBeNull()
      expect(response.body.error).toBe('Plan is not in running status')
    })
  })

  describe('POST /api/plans/:id/logs', () => {
    it('should append log entries to a plan', async () => {
      const createResponse = await request(app)
        .post('/api/plans')
        .send({ name: 'Test Plan', tasks: 'Task 1' })

      const planId = createResponse.body.data.id

      const logs = [
        { task_id: 'task-1', level: 'info', message: 'Starting task' },
        { task_id: 'task-1', level: 'debug', message: 'Processing data' },
        { task_id: 'task-1', level: 'info', message: 'Completed task' },
      ]

      const response = await request(app)
        .post(`/api/plans/${planId}/logs`)
        .send(logs)
        .expect(200)

      expect(response.body.error).toBeNull()
      expect(response.body.data.inserted).toBe(3)
    })

    it('should return 400 if logs is not an array', async () => {
      const createResponse = await request(app)
        .post('/api/plans')
        .send({ name: 'Test Plan', tasks: 'Task 1' })

      const planId = createResponse.body.data.id

      const response = await request(app)
        .post(`/api/plans/${planId}/logs`)
        .send({ task_id: 'task-1', level: 'info', message: 'Not an array' })
        .expect(400)

      expect(response.body.data).toBeNull()
      expect(response.body.error).toBe('logs must be a non-empty array')
    })

    it('should return 400 if logs array is empty', async () => {
      const createResponse = await request(app)
        .post('/api/plans')
        .send({ name: 'Test Plan', tasks: 'Task 1' })

      const planId = createResponse.body.data.id

      const response = await request(app)
        .post(`/api/plans/${planId}/logs`)
        .send([])
        .expect(400)

      expect(response.body.data).toBeNull()
      expect(response.body.error).toBe('logs must be a non-empty array')
    })

    it('should return 404 for non-existent plan', async () => {
      const logs = [
        { task_id: 'task-1', level: 'info', message: 'Test message' },
      ]

      const response = await request(app)
        .post('/api/plans/non-existent-id/logs')
        .send(logs)
        .expect(404)

      expect(response.body.data).toBeNull()
      expect(response.body.error).toBe('Plan not found')
    })
  })

  describe('GET /api/plans/:id/logs', () => {
    it('should return all logs for a plan ordered by created_at ASC', async () => {
      const createResponse = await request(app)
        .post('/api/plans')
        .send({ name: 'Test Plan', tasks: 'Task 1' })

      const planId = createResponse.body.data.id

      const logs = [
        { task_id: 'task-1', level: 'info', message: 'First log' },
        { task_id: 'task-2', level: 'warn', message: 'Second log' },
        { task_id: 'task-3', level: 'error', message: 'Third log' },
      ]

      await request(app)
        .post(`/api/plans/${planId}/logs`)
        .send(logs)

      const response = await request(app)
        .get(`/api/plans/${planId}/logs`)
        .expect(200)

      expect(response.body.error).toBeNull()
      expect(response.body.data).toHaveLength(3)
      expect(response.body.data[0].message).toBe('First log')
      expect(response.body.data[1].message).toBe('Second log')
      expect(response.body.data[2].message).toBe('Third log')
    })

    it('should return empty array when no logs exist', async () => {
      const createResponse = await request(app)
        .post('/api/plans')
        .send({ name: 'Test Plan', tasks: 'Task 1' })

      const planId = createResponse.body.data.id

      const response = await request(app)
        .get(`/api/plans/${planId}/logs`)
        .expect(200)

      expect(response.body.error).toBeNull()
      expect(response.body.data).toEqual([])
    })

    it('should return 404 for non-existent plan', async () => {
      const response = await request(app)
        .get('/api/plans/non-existent-id/logs')
        .expect(404)

      expect(response.body.data).toBeNull()
      expect(response.body.error).toBe('Plan not found')
    })
  })
})
