import { motion, useReducedMotion } from 'motion/react';

export default function Stamp({ mandateId }: { mandateId: string }) {
  const reduce = useReducedMotion();
  return <motion.div className="stamp" data-motion={reduce ? 'reduced' : 'full'} initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 1.6, rotate: -12 }} animate={reduce ? { opacity: 1 } : { opacity: 1, scale: 1, rotate: -6 }} transition={reduce ? { duration: 0.12, ease: 'linear' } : { duration: 0.32, ease: [0.22, 1, 0.36, 1], delay: 0.04 }} aria-label="Gateway signed"><strong>GATEWAY SIGNED</strong><span>{mandateId}</span></motion.div>;
}
