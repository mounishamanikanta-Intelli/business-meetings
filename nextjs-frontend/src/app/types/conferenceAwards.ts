export interface ConferenceAward {
  _id: string;
  awardName: string;
  awardImage: {
    asset?: {
      _id: string;
      url: string;
    };
    alt?: string;
  };
  description?: string;
}


export interface ConferenceAwardsApiResponse {
  success: boolean;
  data: ConferenceAward[];
  count: number;
  error?: string;
}
