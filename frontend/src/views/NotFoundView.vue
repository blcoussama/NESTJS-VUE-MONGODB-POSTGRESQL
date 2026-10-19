<script setup lang="ts">
import { RouterLink } from 'vue-router'
</script>

<template>
  <section class="py-16 text-center" aria-labelledby="nf-title">
    <p class="text-sm font-semibold text-indigo-600">404</p>
    <h1 id="nf-title" class="page-title mt-2">Page introuvable</h1>
    <p class="mt-2 text-slate-600">La page demandée n’existe pas ou a été déplacée.</p>
    <RouterLink to="/jobs" class="btn btn-primary mt-6">Voir les offres</RouterLink>
  </section>
</template>
