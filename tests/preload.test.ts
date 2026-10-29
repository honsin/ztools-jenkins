import { EventEmitter } from 'node:events'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { runInNewContext } from 'node:vm'
import { describe, expect, it } from 'vitest'

const nodeRequire = createRequire(import.meta.url)

type RequestOptions = { path: string; method?: string; headers?: Record<string, string> }

type RecordedRequest = {
  path: string
  method?: string
  headers?: Record<string, string>
  body: string
}

function loadJenkinsService() {
  const requests: RecordedRequest[] = []

  const httpMock = {
    request(options: RequestOptions, callback: (response: EventEmitter & { statusCode: number }) => void) {
      const record: RecordedRequest = {
        path: options.path,
        method: options.method,
        headers: options.headers,
        body: ''
      }
      requests.push(record)

      const request = new EventEmitter() as EventEmitter & {
        write: (chunk: string) => void
        end: () => void
      }
      request.write = (chunk: string) => { record.body += chunk }
      request.end = () => {
        queueMicrotask(() => {
          const response = new EventEmitter() as EventEmitter & { statusCode: number }
          response.statusCode = 200
          callback(response)

          let body: object
          if (options.path.startsWith('/crumbIssuer/api/json')) {
            body = { crumb: 'test-crumb', crumbRequestField: 'Jenkins-Crumb' }
          } else if (options.path.includes('tree=property')) {
            body = {
              property: [{
                _class: 'hudson.model.ParametersDefinitionProperty',
                parameterDefinitions: [
                  {
                    name: 'BRANCH_NAME',
                    type: 'StringParameterDefinition',
                    description: '代码分支',
                    defaultParameterValue: { value: 'GJ-DEV' }
                  },
                  {
                    name: 'MODE',
                    type: 'ChoiceParameterDefinition',
                    description: '构建模式',
                    choices: ['dev', 'prod'],
                    defaultParameterValue: { value: 'dev' }
                  }
                ]
              }]
            }
          } else if (options.path.startsWith('/job/team/api/json')) {
            body = {
              jobs: [{
                name: 'deploy',
                url: 'http://jenkins.example/job/team/job/deploy/',
                color: 'blue',
                _class: 'hudson.model.FreeStyleProject'
              }]
            }
          } else {
            const folder: Record<string, unknown> = {
              name: 'team',
              url: 'http://jenkins.example/job/team/',
              color: 'notbuilt'
            }
            if (options.path.includes('_class')) {
              folder._class = 'com.cloudbees.hudson.plugins.folder.Folder'
            }
            body = { jobs: [folder] }
          }

          response.emit('data', JSON.stringify(body))
          response.emit('end')
        })
      }
      return request
    }
  }

  const sandbox = {
    Buffer,
    URL,
    queueMicrotask,
    window: { ztools: { getPath: () => '' } } as any,
    require(id: string) {
      if (id === 'http' || id === 'https') return httpMock
      return nodeRequire(id)
    }
  }

  const source = readFileSync(resolve('preload.js'), 'utf8')
  runInNewContext(source, sandbox, { filename: 'preload.js' })

  return {
    service: sandbox.window.services.jenkins,
    requests
  }
}

describe('Jenkins folder traversal', () => {
  it('loads jobs inside a folder and assigns their full Jenkins name', async () => {
    const { service, requests } = loadJenkinsService()

    const result = await service.getJobs('http://jenkins.example', 'user', 'token')

    expect(result.error).toBeNull()
    expect(result.data[0].jobs).toEqual([
      expect.objectContaining({ name: 'deploy', fullName: 'team/deploy' })
    ])
    expect(requests.map(r => r.path)).toContainEqual(expect.stringMatching(/^\/job\/team\/api\/json/))
  })

  it('addresses nested jobs with one Jenkins job segment per folder level', async () => {
    const { service, requests } = loadJenkinsService()

    await service.getBuilds('http://jenkins.example', 'user', 'token', 'team/deploy')
    await service.triggerBuild('http://jenkins.example', 'user', 'token', 'team/deploy')

    const paths = requests.map(r => r.path)
    expect(paths).toContainEqual(expect.stringMatching(/^\/job\/team\/job\/deploy\/api\/json/))
    expect(paths).toContain('/job/team/job/deploy/build')
  })
})

describe('Jenkins build parameters', () => {
  it('reads parameter definitions with defaults and choices', async () => {
    const { service, requests } = loadJenkinsService()

    const result = await service.getJobParameters('http://jenkins.example', 'user', 'token', 'team/deploy')

    expect(result.error).toBeNull()
    expect(result.data).toEqual([
      {
        name: 'BRANCH_NAME',
        type: 'StringParameterDefinition',
        description: '代码分支',
        defaultValue: 'GJ-DEV',
        choices: undefined
      },
      {
        name: 'MODE',
        type: 'ChoiceParameterDefinition',
        description: '构建模式',
        defaultValue: 'dev',
        choices: ['dev', 'prod']
      }
    ])
    expect(requests.map(r => r.path)).toContainEqual(
      expect.stringMatching(/^\/job\/team\/job\/deploy\/api\/json\?tree=property\[parameterDefinitions/)
    )
  })

  it('triggers parameterized builds via buildWithParameters with a form body and crumb', async () => {
    const { service, requests } = loadJenkinsService()

    const result = await service.triggerBuild(
      'http://jenkins.example',
      'user',
      'token',
      'team/deploy',
      { BRANCH_NAME: 'GJ-DEV', VERSION_NUM: '3.16.3.0' }
    )

    expect(result.error).toBeNull()

    const buildRequest = requests.find(r => r.path === '/job/team/job/deploy/buildWithParameters')
    expect(buildRequest).toBeTruthy()
    expect(buildRequest?.body).toBe('BRANCH_NAME=GJ-DEV&VERSION_NUM=3.16.3.0')
    expect(buildRequest?.headers?.['Content-Type']).toBe('application/x-www-form-urlencoded')
    expect(buildRequest?.headers?.['Jenkins-Crumb']).toBe('test-crumb')
  })

  it('url-encodes parameter values', async () => {
    const { service, requests } = loadJenkinsService()

    await service.triggerBuild(
      'http://jenkins.example',
      'user',
      'token',
      'team/deploy',
      { BRANCH_NAME: 'feature/中文 分支' }
    )

    const buildRequest = requests.find(r => r.path === '/job/team/job/deploy/buildWithParameters')
    expect(buildRequest?.body).toBe('BRANCH_NAME=feature%2F%E4%B8%AD%E6%96%87%20%E5%88%86%E6%94%AF')
  })
})
