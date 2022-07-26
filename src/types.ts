export type SubtitlerCommand =
  | { type: 'insertTime' }
  | { type: 'playPause' }
  | { type: 'registerSegments'; times: number[]; id: number }
  | { type: 'jump'; time: number }
  | { type: 'seek'; delta: number }

export type SubtitlerNotification =
  | { type: 'setTimeInDocument'; time: string }
  | { type: 'setActiveSegmentIndex'; index: number; id: number }
