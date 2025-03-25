export const STAKING_ABI = [
    'event Staked(address user, uint256 amount)',
    'event UnStaked(address claimer, uint256 stakedTokens)',
] as const
