import { apiClient } from './client';

export interface UpdateProfileData {
  name?: string;
  currentPassword?: string;
  newPassword?: string;
}

export async function updateProfile(data: UpdateProfileData): Promise<void> {
  await apiClient.patch('/auth/profile', data);
}

export async function forgotPassword(email: string): Promise<void> {
  await apiClient.post('/auth/forgot-password', { email });
}
