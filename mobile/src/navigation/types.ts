export type RootStackParamList = {
  RequestOtp: undefined;
  VerifyOtp: { challengeId: string; phone: string };
  Home: undefined;
  Profile: undefined;
  VehiclesList: {
    categoryId: 'swap' | 'home';
    categoryTitle: string;
    hubId: string;
    hubName: string;
    hubAddress: string;
  };
};
