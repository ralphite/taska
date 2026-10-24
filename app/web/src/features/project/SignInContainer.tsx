// The key asked for in the page, with what Sign in does.

import { useApp } from '../../app/context'
import { SheetLayout } from '../../ui/Sheet'
import { signInSheet } from './SignIn'

export function SignInSheet() {
  const app = useApp()
  return (
    <SheetLayout
      {...signInSheet((key, field) => {
        void app.access.signIn(key).then((ok) => {
          if (!ok) field?.select()
        })
      })}
    />
  )
}
