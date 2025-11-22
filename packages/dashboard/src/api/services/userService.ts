import api from '../../services/api';
import { User } from '../../types';

export const userService = {
  getProfile: async (): Promise<User> => {
    const response = await api.get('/users/me');
    return response.data.user;
  },
};
