import { OtlpHttpExporterConfigPartial, makeOtlpHttpPartialConfig } from "./otlphttp"

export type OtelCollectorHoneycombConfiguration = {
  name: "honeycomb"
  enabled: boolean
  endpoint: string
  types: ("logs" | "traces")[]
  apiKey: string
  dataset?: string
}

export function makeHoneycombPartialConfig(config: OtelCollectorHoneycombConfiguration): OtlpHttpExporterConfigPartial {
  return makeOtlpHttpPartialConfig({
    // TODO: Probably should separate the config shape from the exporter shape
    name: "otlphttp",
    enabled: config.enabled,
    endpoint: config.endpoint,
    types: config.types,
    headers: {
      "x-honeycomb-team": config.apiKey,
      "x-honeycomb-dataset": config.dataset
    },
  })
}
