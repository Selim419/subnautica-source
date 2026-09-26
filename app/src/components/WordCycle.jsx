import { motion } from 'motion/react'

const cn = (...parts) => parts.filter(Boolean).join(' ')
const STAGGER = 0.035

export function WordCycle({ children, className, center = false }) {
  const text = String(children)
  return (
    <motion.span
      initial="initial"
      whileHover="hovered"
      className={cn('relative block overflow-hidden', className)}
      style={{ lineHeight: 0.75 }}
    >
      <div>
        {text.split('').map((l, i) => (
          <motion.span
            key={`a${i}`}
            variants={{ initial: { y: 0 }, hovered: { y: '-100%' } }}
            transition={{ ease: 'easeInOut', delay: center ? STAGGER * Math.abs(i - (text.length - 1) / 2) : STAGGER * i }}
            className="inline-block"
          >{l}</motion.span>
        ))}
      </div>
      <div className="absolute inset-0" aria-hidden="true">
        {text.split('').map((l, i) => (
          <motion.span
            key={`b${i}`}
            variants={{ initial: { y: '100%' }, hovered: { y: 0 } }}
            transition={{ ease: 'easeInOut', delay: center ? STAGGER * Math.abs(i - (text.length - 1) / 2) : STAGGER * i }}
            className="inline-block"
          >{l}</motion.span>
        ))}
      </div>
    </motion.span>
  )
}

export default WordCycle
