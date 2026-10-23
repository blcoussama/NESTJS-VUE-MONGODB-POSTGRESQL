<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { safeHttpUrl } from '@/utils/url'

const props = withDefaults(
  defineProps<{
    src?: string | null
    /** Used for the alt text and the initials fallback. */
    name: string
    size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
    shape?: 'circle' | 'square'
    /** Allows local `blob:` previews (never API data). */
    allowBlob?: boolean
  }>(),
  { size: 'md', shape: 'circle', allowBlob: false },
)

const failed = ref(false)
watch(
  () => props.src,
  () => (failed.value = false),
)

const safeSrc = computed(() => {
  if (!props.src || failed.value) return null
  if (props.allowBlob && props.src.startsWith('blob:')) return props.src
  return safeHttpUrl(props.src)
})

const initials = computed(() => {
  const parts = props.name.trim().split(/\s+/).filter(Boolean)
  const letters = parts.length > 1 ? `${parts[0]![0]}${parts[parts.length - 1]![0]}` : (parts[0]?.slice(0, 2) ?? '?')
  return letters.toUpperCase()
})

const sizeClass = computed(
  () =>
    ({
      xs: 'h-6 w-6 text-[10px]',
      sm: 'h-8 w-8 text-xs',
      md: 'h-10 w-10 text-sm',
      lg: 'h-16 w-16 text-lg',
      xl: 'h-24 w-24 text-2xl',
    })[props.size],
)
</script>

<template>
  <span
    class="relative inline-flex shrink-0 items-center justify-center overflow-hidden bg-indigo-100 font-semibold text-indigo-700"
    :class="[sizeClass, shape === 'circle' ? 'rounded-full' : 'rounded-lg']"
  >
    <img
      v-if="safeSrc"
      :src="safeSrc"
      :alt="name"
      class="h-full w-full object-cover"
      loading="lazy"
      referrerpolicy="no-referrer"
      @error="failed = true"
    />
    <span v-else aria-hidden="true">{{ initials }}</span>
    <span v-if="!safeSrc" class="sr-only">{{ name }}</span>
  </span>
</template>
