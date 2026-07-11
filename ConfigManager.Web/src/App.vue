<script setup lang="ts">
import { RouterView } from 'vue-router'
</script>

<template>
  <div id="app">
    <header class="app-header">
      <div class="header-content">
        <h1 class="app-title">ConfigManager</h1>
        <p class="app-subtitle">Configuration Management Interface</p>
      </div>
    </header>

    <main class="app-main">
      <RouterView />
    </main>
  </div>
</template>

<style scoped>
#app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.app-header {
  background: var(--color-background-soft);
  border-bottom: 1px solid var(--color-border);
  padding: 1.5rem 0;
}

.header-content {
  width: 100%;
  margin: 0;
  padding: 0 2rem;
}

.app-title {
  margin: 0 0 0.5rem 0;
  font-size: 2rem;
  font-weight: 600;
  color: var(--color-heading);
}

.app-subtitle {
  margin: 0;
  color: var(--color-text-2);
  font-size: 1.1rem;
}

.app-main {
  flex: 1;
  padding: 1rem 0;
}
</style>
