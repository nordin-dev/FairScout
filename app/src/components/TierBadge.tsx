import type { Tier } from '../lib/types';
import { blind } from '../lib/text.en';
import './TierBadge.css';

type TierBadgeProps = {
  tier: Tier;
  size?: 'normal' | 'xl';
};

/** The model's tier. The letter is always shown, so colour never carries the tier alone. */
export function TierBadge({ tier, size = 'normal' }: TierBadgeProps) {
  const cls = `tier tier-${tier.toLowerCase()}${size === 'xl' ? ' xl' : ''}`;
  return (
    <span className={cls} role="img" aria-label={blind.tierLabel(tier)}>
      {tier}
    </span>
  );
}
