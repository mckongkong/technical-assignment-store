import { JSONArray, JSONObject, JSONPrimitive } from "./json-types";

import "reflect-metadata";

import {get, set} from 'lodash';

export type Permission = "r" | "w" | "rw" | "none";

export type StoreResult = Store | JSONPrimitive | undefined;

export type StoreValue =
| JSONObject
| JSONArray
| StoreResult
| (() => StoreResult);

export interface IStore {
  defaultPolicy: Permission;
  allowedToRead(key: string): boolean;
  allowedToWrite(key: string): boolean;
  read(path: string): StoreResult;
  write(path: string, value: StoreValue): StoreValue;
  writeEntries(entries: JSONObject): void;
  entries(): JSONObject;
}

const restrictMetadataKey = Symbol("restrict");

export function Restrict(permission?: Permission): any {
  return Reflect.metadata(restrictMetadataKey, permission ?? 'none')
}

export class Store implements IStore {
  defaultPolicy: Permission = "rw";

  allowedToRead(key: string): boolean {
    const restricton = Reflect.getMetadata(restrictMetadataKey,this,key)
    if(!restricton){
      return this.defaultPolicy !== 'none'
    }else{
      return restricton !== 'none'
    }
  }

  allowedToWrite(key: string): boolean {
    const restricton = Reflect.getMetadata(restrictMetadataKey,this,key)
    if(!restricton){
      return this.defaultPolicy === 'rw'
    }else{
      return restricton === 'rw'
    }
  }

  read(path: string): StoreResult {
    const keys = path.split(':')
    let arrayOfKeys: string[] = [];    
    let callerObject = Object.create(this)

    for(const key of keys){
      arrayOfKeys.push(key);

      if(!callerObject.allowedToRead(key)){
        throw new Error(`Cannot read property ${key}`)
      }
      
      const currentValue = get(this,arrayOfKeys)

      if(currentValue instanceof Store){
        callerObject = Object.create(currentValue);
        arrayOfKeys = []
      } else if(typeof currentValue == 'function'){
        callerObject = Object.create(currentValue())
        arrayOfKeys = []
      }
    }

    let result;
    const finalValue = get(callerObject,arrayOfKeys)

    if((typeof finalValue === 'object' || finalValue == undefined)){
      result = Object.create(callerObject);
      Object.assign(result,finalValue)
      set(this,keys,result)
    } else {
      result = finalValue
    }

    return result;
  }

  write(path: string, value: StoreValue): StoreValue {
    const keys = path.split(':')
    let arrayOfKeys: string[] = [];
    let callerObject = Object.create(this)

    for(const key of keys){
      arrayOfKeys.push(key);
      if(keys.length !== arrayOfKeys.length){
        if(!callerObject.allowedToRead(key)){
          throw new Error(`Cannot read property ${key}`)
        }
        if(get(this, arrayOfKeys) instanceof Store){
          callerObject = Object.create(get(this, arrayOfKeys));
        }
      }else{
        if(!callerObject.allowedToWrite(key)){
          throw new Error(`Cannot write property ${key}`)
        }
      }
    }
    return set(this,arrayOfKeys,value)
  }

  writeEntries(entries: JSONObject): void {
    const keys = Object.keys(entries);
    for(const key of keys){
      this.write(key,entries[key])
    }
  }

  entries(): JSONObject {
    const keys = Object.keys(this);
    keys.splice(keys.indexOf('defaultPolicy'), 1)
    const obj: JSONObject = {}
    for(const key of keys){
      if(this.allowedToRead(key)){
        obj[key] = (this as any)[key]
      }
    }
    return obj;
  }
}
