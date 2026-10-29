// @vitest-environment jsdom

import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import BuildDialog from '../src/components/BuildDialog.vue'
import type { JobInfo, JobParameter } from '../src/types'

const job: JobInfo = {
  name: 'deploy',
  fullName: 'team/deploy',
  url: 'http://jenkins.example/job/team/job/deploy/',
  color: 'blue'
}

const parameters: JobParameter[] = [
  { name: 'BRANCH_NAME', type: 'StringParameterDefinition', description: '代码分支', defaultValue: 'GJ-DEV' },
  { name: 'MODE', type: 'ChoiceParameterDefinition', description: '构建模式', choices: ['dev', 'prod'], defaultValue: 'prod' },
  { name: 'ENABLE', type: 'BooleanParameterDefinition', description: '是否启用', defaultValue: false }
]

const mountDialog = (overrides: Record<string, unknown> = {}) => mount(BuildDialog, {
  props: {
    show: true,
    job,
    parameters,
    loading: false,
    building: false,
    error: null,
    ...overrides
  }
})

describe('BuildDialog parameters', () => {
  it('prefills defaults and renders descriptions', () => {
    const wrapper = mountDialog()

    expect(wrapper.find('.param-input').element).toHaveProperty('value', 'GJ-DEV')
    expect(wrapper.find('select').element).toHaveProperty('value', 'prod')
    expect((wrapper.find('input[type="checkbox"]').element as HTMLInputElement).checked).toBe(false)
    expect(wrapper.text()).toContain('代码分支')
    expect(wrapper.text()).toContain('构建模式')
  })

  it('emits edited parameter values on submit', async () => {
    const wrapper = mountDialog()

    await wrapper.find('.param-input').setValue('release')
    await wrapper.find('select').setValue('dev')
    await wrapper.find('input[type="checkbox"]').setValue(true)
    await wrapper.find('form').trigger('submit')

    expect(wrapper.emitted('confirm')?.[0][0]).toEqual({
      BRANCH_NAME: 'release',
      MODE: 'dev',
      ENABLE: 'true'
    })
  })

  it('falls back to a confirmation dialog for jobs without parameters', () => {
    const wrapper = mountDialog({ parameters: [] })

    expect(wrapper.text()).toContain('确认构建')
    expect(wrapper.find('.param-input').exists()).toBe(false)
  })

  it('shows a loading state while fetching parameters', () => {
    const wrapper = mountDialog({ loading: true })

    expect(wrapper.text()).toContain('加载构建参数中')
    expect(wrapper.find('.btn-primary').attributes('disabled')).toBeDefined()
  })
})
