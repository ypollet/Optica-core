import type { DataProvider } from "./providers";
import { WebProvider } from "./web_providers";
import { OrthancProvider } from "./orthanc_providers";
import { providerSettings } from "../../config/appSettings"

// Backends an app can be served by (VITE_BACKEND_TYPE)
export type BackendType = "WEB" | "ORTHANC"

// how to build the provider of each backend from its url (VITE_BACKEND_URL)
export type ProviderBuilders<P extends DataProvider> = Record<BackendType, (url: string) => P>

// The core providers, `plugin`: the path of the app in Orthanc
export function coreProviders(plugin: string): ProviderBuilders<DataProvider> {
    return {
        WEB: (url) => new WebProvider(url),
        ORTHANC: (url) => new OrthancProvider(url, plugin),
    }
}

// Provider of the backend set in the environment (.env: VITE_BACKEND_TYPE, VITE_BACKEND_URL).
// Apps with their own routes pass their own providers (sphaer)
export function createProvider<P extends DataProvider>(builders: ProviderBuilders<P>): P {
    const type = providerSettings.type
    if (!(type in builders)) {
        throw new Error(`Unknown VITE_BACKEND_TYPE "${type}", expected one of ${Object.keys(builders).join(", ")}`)
    }
    return builders[type as BackendType](providerSettings.url)
}
