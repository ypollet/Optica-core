import type { Repository } from "./repository";
import type { DataProvider } from "../providers/providers";
import { ProviderFactory } from "../providers/provider_factory";
import { providerSettings, repositorySettings } from "../../config/appSettings"

type RepositoryBuilder = (provider: DataProvider) => Repository<any>

// Apps register their repository at startup:
// RepositoryFactory.register("DATA", (provider) => new StackRepository(provider))
export class RepositoryFactory{
    private static _instances = new Map<string, Repository<any>>()
    private static _builders = new Map<string, RepositoryBuilder>()

    static register(type : string, builder : RepositoryBuilder){
        this._builders.set(type, builder)
        this._instances.delete(type)
    }

    static get<R extends Repository<any> = Repository>(type : string = repositorySettings.type) : R{
        let instance = this._instances.get(type)
        if(instance == null){
            const builder = this._builders.get(type)
            if(builder == null){
                throw new Error(`Unknown repository type "${type}"`)
            }
            instance = builder(ProviderFactory.get(providerSettings.type))
            this._instances.set(type, instance)
        }
        return instance as R
    }
}
