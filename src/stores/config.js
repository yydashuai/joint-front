import { defineStore } from 'pinia'
import { systemConfig as seedConfig } from '@/mock/users'

export const useConfigStore = defineStore('config', {
  state: () => ({
    network: { ...seedConfig.network },
    log: { ...seedConfig.log },
    notification: { ...seedConfig.notification },
  }),

  actions: {
    saveGroup(group, value) {
      if (!this[group]) return
      Object.assign(this[group], value)
      if (seedConfig[group]) Object.assign(seedConfig[group], this[group])
    },
  },
})
