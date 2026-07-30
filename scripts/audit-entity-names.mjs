import { createPinia, setActivePinia } from 'pinia'
import { createServer } from 'vite'

const server = await createServer({
  server: { middlewareMode: true },
  appType: 'custom',
})

try {
  setActivePinia(createPinia())
  const [
    protocolModule,
    testDataModule,
    systemModule,
    connectionModule,
    planSchemeModule,
    datasetSchemeModule,
    testTaskModule,
    ruleModule,
  ] = await Promise.all([
    server.ssrLoadModule('/src/stores/protocol.js'),
    server.ssrLoadModule('/src/stores/testData.js'),
    server.ssrLoadModule('/src/stores/system.js'),
    server.ssrLoadModule('/src/stores/connection.js'),
    server.ssrLoadModule('/src/stores/planScheme.js'),
    server.ssrLoadModule('/src/stores/datasetScheme.js'),
    server.ssrLoadModule('/src/stores/testTask.js'),
    server.ssrLoadModule('/src/stores/rule.js'),
  ])

  const protocolStore = protocolModule.useProtocolStore()
  protocolStore.migrateAllFromV1()

  const groups = [
    ['系统', systemModule.useSystemStore().systems],
    ['模块', connectionModule.useConnectionStore().nodes],
    ['字段', protocolStore.protocols],
    ['报文', protocolStore.interfaces],
    ['接口', protocolStore.testInterfaces],
    ['数据集', testDataModule.useTestDataStore().datasets],
    ['数据文件', testDataModule.useTestDataStore().files],
    ['接口方案', planSchemeModule.usePlanSchemeStore().schemes],
    ['数据集方案', datasetSchemeModule.useDatasetSchemeStore().schemes],
    ['任务', testTaskModule.useTestTaskStore().tasks],
    ['规则集', ruleModule.useRuleStore().ruleSets],
  ]

  const seen = new Map()
  const duplicates = []
  groups.forEach(([type, items]) => {
    items.forEach((item) => {
      const normalized = String(item.name || '').trim().toLocaleLowerCase()
      if (!normalized) return
      if (seen.has(normalized)) {
        duplicates.push({ name: item.name, first: seen.get(normalized), second: type })
      } else {
        seen.set(normalized, type)
      }
    })
  })

  const directionalFields = protocolStore.protocols
    .filter((field) => /(请求|响应|发送|接收)/.test(field.name))
    .map((field) => field.name)

  console.log(JSON.stringify({
    counts: Object.fromEntries(groups.map(([type, items]) => [type, items.length])),
    duplicates,
    directionalFields,
  }, null, 2))

  if (duplicates.length || directionalFields.length) process.exitCode = 1
} finally {
  await server.close()
}
