import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'motion/react';
import PixelSprite from './PixelSprite';

export default function HeartsMeter({ hearts, max }: { hearts: number; max: number }) {
  const reducedMotion = useReducedMotion();
  const previousHearts = useRef(hearts);
  const [brokenHeart, setBrokenHeart] = useState<number | null>(null);

  useEffect(() => {
    const decreased = hearts < previousHearts.current;
    previousHearts.current = hearts;

    if (!decreased || reducedMotion) {
      setBrokenHeart(null);
      return;
    }

    setBrokenHeart(hearts);
    const timeout = window.setTimeout(() => setBrokenHeart(null), 650);
    return () => window.clearTimeout(timeout);
  }, [hearts, reducedMotion]);

  return (
    <div className="hearts-meter" aria-label={`Attention: ${hearts} of ${max} hearts left`} role="img">
      {Array.from({ length: max }, (_, index) => (
        <span key={index} aria-hidden="true" data-heart={index < hearts ? 'full' : 'empty'}>
          {index < hearts ? '♥' : '♡'}
          {brokenHeart === index && (
            <span className="heart-break" data-heart-break={index} aria-hidden="true">
              <PixelSprite name="heart_left" />
              <PixelSprite name="heart_right" />
            </span>
          )}
        </span>
      ))}
      <span>{hearts} of {max}</span>
    </div>
  );
}
