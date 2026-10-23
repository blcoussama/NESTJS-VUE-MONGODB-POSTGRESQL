<script setup lang="ts">
defineProps<{ title: string; subtitle?: string }>()
</script>

<template>
  <section class="mx-auto w-full max-w-md" :aria-labelledby="'auth-title'">
    <div class="card p-8">
      <h1 id="auth-title" class="page-title text-center">{{ title }}</h1>
      <p v-if="subtitle" class="mt-2 text-center text-sm text-slate-500">{{ subtitle }}</p>
      <div class="mt-6"><slot /></div>
    </div>
    <div v-if="$slots.footer" class="mt-4 text-center text-sm text-slate-600"><slot name="footer" /></div>
  </section>
</template>
