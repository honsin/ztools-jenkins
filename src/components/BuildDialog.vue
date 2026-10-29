<template>
  <div v-if="show" class="modal-overlay" @click.self="handleOverlayClick">
    <form class="modal build-dialog" @submit.prevent="handleConfirm">
      <div class="modal-header">
        <span class="modal-title">{{ parameters.length > 0 ? '构建参数' : '确认构建' }}</span>
        <button type="button" class="close-btn" :disabled="building" @click="emit('close')">×</button>
      </div>

      <div class="modal-body">
        <div v-if="loading" class="dialog-loading">加载构建参数中...</div>

        <template v-else>
          <div v-if="error" class="error-text">{{ error }}</div>

          <div v-if="parameters.length === 0" class="confirm-text">
            确定要触发 <strong>{{ job?.name }}</strong> 的构建吗？
          </div>

          <div v-else class="param-list">
            <div v-for="param in parameters" :key="param.name" class="param-group">
              <label class="param-label">{{ param.name }}</label>

              <label v-if="isBoolean(param)" class="param-checkbox">
                <input
                  v-model="boolForm[param.name]"
                  type="checkbox"
                  :disabled="building"
                />
                <span>启用</span>
              </label>

              <select
                v-else-if="isChoice(param)"
                v-model="textForm[param.name]"
                class="param-input"
                :disabled="building"
              >
                <option v-for="choice in param.choices" :key="choice" :value="choice">
                  {{ choice }}
                </option>
              </select>

              <textarea
                v-else-if="isTextArea(param)"
                v-model="textForm[param.name]"
                class="param-input"
                rows="3"
                :disabled="building"
              ></textarea>

              <input
                v-else
                v-model="textForm[param.name]"
                class="param-input"
                :type="isPassword(param) ? 'password' : 'text'"
                :disabled="building"
              />

              <span v-if="param.description" class="param-description">{{ param.description }}</span>
            </div>
          </div>
        </template>
      </div>

      <div class="modal-footer">
        <button type="button" class="btn btn-default" :disabled="building" @click="emit('close')">
          取消
        </button>
        <button type="submit" class="btn btn-primary" :disabled="loading || building">
          {{ building ? '构建中...' : '确认构建' }}
        </button>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
import { reactive, watch } from 'vue'
import type { JobInfo, JobParameter } from '../types'

const props = defineProps<{
  show: boolean
  job: JobInfo | null
  parameters: JobParameter[]
  loading: boolean
  building: boolean
  error: string | null
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'confirm', values?: Record<string, string>): void
}>()

const textForm = reactive<Record<string, string>>({})
const boolForm = reactive<Record<string, boolean>>({})

const isBoolean = (param: JobParameter) => param.type === 'BooleanParameterDefinition'
const isChoice = (param: JobParameter) => param.type === 'ChoiceParameterDefinition'
const isPassword = (param: JobParameter) => param.type === 'PasswordParameterDefinition'
const isTextArea = (param: JobParameter) => param.type === 'TextParameterDefinition'

/**
 * 用 Jenkins 默认值初始化表单；选项参数若默认值不在选项里则取第一项
 */
const resetForm = () => {
  Object.keys(textForm).forEach(key => delete textForm[key])
  Object.keys(boolForm).forEach(key => delete boolForm[key])

  for (const param of props.parameters) {
    if (isBoolean(param)) {
      boolForm[param.name] = param.defaultValue === true || param.defaultValue === 'true'
    } else if (isChoice(param)) {
      const choices = param.choices || []
      const defaultValue = param.defaultValue === undefined ? '' : String(param.defaultValue)
      textForm[param.name] = choices.includes(defaultValue) ? defaultValue : (choices[0] || '')
    } else {
      textForm[param.name] = param.defaultValue === undefined ? '' : String(param.defaultValue)
    }
  }
}

watch(
  [() => props.show, () => props.parameters],
  ([show]) => {
    if (show) resetForm()
  },
  { immediate: true }
)

const handleConfirm = () => {
  if (props.loading || props.building) return

  const values: Record<string, string> = {}
  for (const param of props.parameters) {
    values[param.name] = isBoolean(param)
      ? String(boolForm[param.name])
      : (textForm[param.name] ?? '')
  }

  emit('confirm', props.parameters.length > 0 ? values : undefined)
}

const handleOverlayClick = () => {
  if (props.building) return
  emit('close')
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.build-dialog {
  background: var(--bg-color, #fff);
  border-radius: 8px;
  width: 420px;
  max-width: 90vw;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 20px;
  border-bottom: 1px solid var(--border-color, #e0e0e0);
}

.modal-title {
  font-size: 15px;
  font-weight: 600;
}

.close-btn {
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
  border-radius: 4px;
  color: var(--text-color, #333);
}

.close-btn:hover:not(:disabled) {
  background: var(--bg-hover, #f0f0f0);
}

.close-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px 20px;
}

.dialog-loading {
  padding: 16px 0;
  text-align: center;
  color: var(--text-secondary, #666);
  font-size: 13px;
}

.confirm-text {
  font-size: 13px;
  line-height: 1.6;
}

.param-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.param-group {
  display: flex;
  flex-direction: column;
}

.param-label {
  margin-bottom: 4px;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-color, #333);
  font-family: Consolas, Monaco, 'Courier New', monospace;
}

.param-input {
  padding: 8px 10px;
  border: 1px solid var(--border-color, #e0e0e0);
  border-radius: 4px;
  font-size: 13px;
  box-sizing: border-box;
  background: var(--bg-color, #fff);
  color: var(--text-color, #333);
  font-family: inherit;
  transition: border-color 0.15s;
}

.param-input:focus {
  outline: none;
  border-color: var(--primary-color, #0078d4);
}

.param-input:disabled {
  opacity: 0.6;
}

textarea.param-input {
  resize: vertical;
  min-height: 60px;
}

.param-checkbox {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--text-color, #333);
  cursor: pointer;
}

.param-description {
  margin-top: 4px;
  font-size: 11px;
  color: var(--text-secondary, #888);
}

.error-text {
  margin-bottom: 12px;
  padding: 8px 12px;
  background: #fff2f0;
  border: 1px solid #ffccc7;
  border-radius: 4px;
  color: #ff4d4f;
  font-size: 12px;
}

.modal-footer {
  padding: 12px 20px;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  border-top: 1px solid var(--border-color, #e0e0e0);
}

.btn {
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  transition: opacity 0.15s, background 0.15s;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-default {
  background: var(--bg-color, #fff);
  border: 1px solid var(--border-color, #e0e0e0);
  color: var(--text-color, #333);
}

.btn-default:hover:not(:disabled) {
  background: var(--bg-hover, #f5f5f5);
}

.btn-primary {
  background: var(--primary-color, #0078d4);
  border: 1px solid var(--primary-color, #0078d4);
  color: #fff;
}

.btn-primary:hover:not(:disabled) {
  background: #006abc;
}

@media (prefers-color-scheme: dark) {
  .error-text {
    background: rgba(255, 77, 79, 0.1);
    border-color: rgba(255, 77, 79, 0.3);
  }
}
</style>
