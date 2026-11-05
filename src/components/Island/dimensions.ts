import { IslandStyle, IslandState, ActiveTab } from '../../types';

export interface StyleDimension {
  width: number;
  height: number;
  borderRadius: string;
  top: number;
}

export const ISLAND_DIMENSIONS: Record<IslandStyle, Record<IslandState, StyleDimension>> = {
  pill: {
    compact: { width: 196, height: 40, borderRadius: '20px 20px 20px 20px', top: 12 },
    notification: { width: 320, height: 72, borderRadius: '28px 28px 28px 28px', top: 12 },
    expanded: { width: 320, height: 188, borderRadius: '36px 36px 36px 36px', top: 12 },
  },
  notch: {
    compact: { width: 220, height: 34, borderRadius: '0px 0px 18px 18px', top: 0 },
    notification: { width: 320, height: 70, borderRadius: '0px 0px 24px 24px', top: 0 },
    expanded: { width: 320, height: 190, borderRadius: '0px 0px 36px 36px', top: 0 },
  },
};

export const getIslandDimensions = (
  style: IslandStyle = 'pill',
  state: IslandState = 'compact',
  isPlaying: boolean = false,
  activeTab: ActiveTab = 'all'
): StyleDimension => {
  if (style === 'notch') {
    if (state === 'compact') {
      return isPlaying
        ? { width: 280, height: 36, borderRadius: '0px 0px 18px 18px', top: 0 }
        : { width: 220, height: 34, borderRadius: '0px 0px 18px 18px', top: 0 };
    }
    if (state === 'expanded') {
      switch (activeTab) {
        case 'todo':
          return { width: 580, height: 230, borderRadius: '0px 0px 36px 36px', top: 0 };
        case 'calendar':
          return { width: 480, height: 215, borderRadius: '0px 0px 36px 36px', top: 0 };
        case 'clipboard':
          return { width: 540, height: 240, borderRadius: '0px 0px 36px 36px', top: 0 };
        case 'battery':
          return { width: 480, height: 232, borderRadius: '0px 0px 36px 36px', top: 0 };
        case 'servers':
          return { width: 620, height: 360, borderRadius: '0px 0px 36px 36px', top: 0 };
        case 'notifications':
          return { width: 360, height: 215, borderRadius: '0px 0px 36px 36px', top: 0 };
        case 'weather':
          return { width: 330, height: 190, borderRadius: '0px 0px 36px 36px', top: 0 };
        case 'all':
        default:
          return { width: 320, height: 190, borderRadius: '0px 0px 36px 36px', top: 0 };
      }
    }
    return ISLAND_DIMENSIONS.notch[state];
  }

  if (state === 'compact') {
    return isPlaying
      ? { width: 236, height: 40, borderRadius: '20px 20px 20px 20px', top: 12 }
      : { width: 196, height: 40, borderRadius: '20px 20px 20px 20px', top: 12 };
  }

  if (state === 'expanded') {
    switch (activeTab) {
      case 'todo':
        return { width: 580, height: 230, borderRadius: '36px 36px 36px 36px', top: 12 };
      case 'calendar':
        return { width: 480, height: 215, borderRadius: '36px 36px 36px 36px', top: 12 };
      case 'clipboard':
        return { width: 540, height: 240, borderRadius: '36px 36px 36px 36px', top: 12 };
      case 'battery':
        return { width: 480, height: 232, borderRadius: '36px 36px 36px 36px', top: 12 };
      case 'servers':
        return { width: 620, height: 360, borderRadius: '36px 36px 36px 36px', top: 12 };
      case 'notifications':
        return { width: 360, height: 215, borderRadius: '36px 36px 36px 36px', top: 12 };
      case 'weather':
        return { width: 330, height: 188, borderRadius: '36px 36px 36px 36px', top: 12 };
      case 'all':
      default:
        return { width: 320, height: 188, borderRadius: '36px 36px 36px 36px', top: 12 };
    }
  }

  return ISLAND_DIMENSIONS.pill[state];
};

export const ISLAND_TOP = 12;
