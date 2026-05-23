import { defineStore } from 'pinia'

export interface GeneratedUser {
  id: number
  username: string
  password: string
  profileName: string
  createdAt: string
}

export const useVoucherStore = defineStore('voucher', () => {
  const lastGenerated = ref<GeneratedUser[]>([])
  const profileName = ref('')

  function setGenerated(users: GeneratedUser[], profile: string) {
    lastGenerated.value = users
    profileName.value = profile
  }

  function clear() {
    lastGenerated.value = []
    profileName.value = ''
  }

  return { lastGenerated, profileName, setGenerated, clear }
})
