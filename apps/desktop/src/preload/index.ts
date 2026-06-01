import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'

import {
  authChannel,
  type AuthBridge,
  type AuthErrorContext,
  type AuthUser,
} from '../shared/auth.ts'

const remoraAuth: AuthBridge = {
  getUser: () => ipcRenderer.invoke(`${authChannel}:get-user`),
  requestAuth: () => ipcRenderer.invoke(`${authChannel}:request-auth`),
  signOut: () => ipcRenderer.invoke(`${authChannel}:sign-out`),
  onAuthenticated(callback) {
    const listener = (_event: IpcRendererEvent, user: AuthUser) => {
      callback(user)
    }

    ipcRenderer.on(`${authChannel}:authenticated`, listener)

    return () => {
      ipcRenderer.off(`${authChannel}:authenticated`, listener)
    }
  },
  onUserUpdated(callback) {
    const listener = (_event: IpcRendererEvent, user: AuthUser | null) => {
      callback(user)
    }

    ipcRenderer.on(`${authChannel}:user-updated`, listener)

    return () => {
      ipcRenderer.off(`${authChannel}:user-updated`, listener)
    }
  },
  onAuthError(callback) {
    const listener = (_event: IpcRendererEvent, context: AuthErrorContext) => {
      callback(context)
    }

    ipcRenderer.on(`${authChannel}:error`, listener)

    return () => {
      ipcRenderer.off(`${authChannel}:error`, listener)
    }
  },
}

contextBridge.exposeInMainWorld('remoraAuth', remoraAuth)
