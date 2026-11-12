import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { Draggable } from 'gsap/Draggable'
import { InertiaPlugin } from 'gsap/InertiaPlugin'

gsap.registerPlugin(ScrollTrigger, Draggable, InertiaPlugin)
gsap.config({ nullTargetWarn: false })
gsap.defaults({ ease: 'power3.out' })

export { gsap, ScrollTrigger, Draggable, InertiaPlugin }
