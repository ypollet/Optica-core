import type { DataProvider } from "./providers";
import { WebProvider } from "./web_providers";
import { providerSettings } from "../../config/appSettings"

type ProviderBuilder = (url: string) => DataProvider

// "ORTHANC" needs the plugin name of the app, register it with
// ProviderFactory.register("ORTHANC", (url) => new OrthancProvider(url, "polaroptica"))
export class ProviderFactory{
    private static _instances = new Map<string, DataProvider>()
    private static _builders = new Map<string, ProviderBuilder>([
        ["WEB", (url) => new WebProvider(url)],
    ])

    static register(type : string, builder : ProviderBuilder){
        this._builders.set(type, builder)
        this._instances.delete(type)
    }

    static get(type : string = providerSettings.type) : DataProvider{
        let instance = this._instances.get(type)
        if(instance == null){
            const builder = this._builders.get(type)
            if(builder == null){
                throw new Error(`Unknown provider type "${type}"`)
            }
            instance = builder(providerSettings.url)
            this._instances.set(type, instance)
        }
        return instance
    }
}
