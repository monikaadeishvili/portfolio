import { Hello } from './hello/Hello'
import { Craft } from './craft/Craft'
import { Proof } from './proof/Proof'
import { Contact } from './contact/Contact'
import type { SectionProps } from './Artboard'

export function Sections(props: SectionProps) {
  return (
    <>
      <Hello {...props} />
      <Craft {...props} />
      <Proof {...props} />
      <Contact {...props} />
    </>
  )
}
