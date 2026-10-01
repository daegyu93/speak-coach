import type { Scenario } from '../types';

export const SCENARIOS: Scenario[] = [
  {
    id: 'immigration', emoji: '🛂', title_ko: '공항 입국심사',
    role_en: 'a U.S. immigration officer at San Francisco International Airport',
    setting_en: 'The traveler has just arrived to attend the NVIDIA GTC conference. Ask typical entry questions one at a time: purpose of visit, length of stay, where they are staying, their job, and items to declare.',
  },
  {
    id: 'hotel', emoji: '🏨', title_ko: '호텔 체크인',
    role_en: 'a front desk clerk at a hotel in San Jose',
    setting_en: 'The guest is checking in for a 10-night stay. Handle the reservation name, ID, a credit card hold for incidentals, the room number and breakfast information.',
  },
  {
    id: 'cafe', emoji: '☕', title_ko: '카페 주문',
    role_en: 'a barista at a busy American coffee shop',
    setting_en: 'Take the order: drink, size, milk or sweetener, for here or to go, a name for the cup, payment, and the tip screen.',
  },
  {
    id: 'restaurant', emoji: '🍽️', title_ko: '식당',
    role_en: 'a server at a casual American restaurant',
    setting_en: 'Seat the guest, take drink and food orders, check on the meal, and handle the check and tip.',
  },
  {
    id: 'ride', emoji: '🚗', title_ko: '우버·길 묻기',
    role_en: 'an Uber driver in San Jose',
    setting_en: 'Pick up the rider, confirm their name and destination (the convention center or their hotel), and make light conversation during the ride.',
  },
  {
    id: 'smalltalk', emoji: '🎤', title_ko: '행사장 스몰토크',
    role_en: 'Mike, an American engineer attending NVIDIA GTC',
    setting_en: 'You meet the user in the coffee line after a keynote. Make small talk about the keynote, why they came, their work, and exchanging contacts.',
  },
];

export function makeCustomScenario(text: string): Scenario | null {
  const t = text.trim();
  if (!t) return null;
  return {
    id: 'custom', emoji: '✏️', title_ko: t,
    role_en: 'the most natural conversation partner for this situation',
    setting_en: `The learner described the situation (possibly in Korean): "${t}". Play the other person in it.`,
  };
}
