<script setup lang="ts">
import { computed } from 'vue'
import { safeHttpUrl } from '@/utils/url'

const props = defineProps<{ href: string | null | undefined }>()
const safe = computed(() => safeHttpUrl(props.href))
</script>

<template>
  <a v-if="safe" :href="safe" target="_blank" rel="noopener noreferrer" class="link">
    <slot>{{ safe }}</slot>
    <span class="sr-only"> (s’ouvre dans un nouvel onglet)</span>
  </a>
  <span v-else class="text-slate-500"><slot>{{ href }}</slot></span>
</template>
