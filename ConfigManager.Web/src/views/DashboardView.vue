<template>
  <div class="dashboard">
    <div class="dashboard-layout">
      <section class="project-section">
        <ProjectSelector />
      </section>
      
      <section class="config-section">
        <ConfigEditor />
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import ProjectSelector from '@/components/ProjectSelector.vue'
import ConfigEditor from '@/components/ConfigEditor.vue'
</script>

<style scoped>
.dashboard {
  width: 100%;
  margin: 0;
  padding: 0 2rem;
}

.dashboard-layout {
  display: grid;
  grid-template-columns: 1.5fr 2.5fr;
  gap: 2rem;
  min-height: 70vh;
}

.project-section {
  background: var(--color-background);
  border-radius: 8px;
  border: 1px solid var(--color-border);
  overflow: hidden;
}

.config-section {
  background: var(--color-background);
  border-radius: 8px;
  border: 1px solid var(--color-border);
  overflow: hidden;
}

@media (max-width: 768px) {
  .dashboard-layout {
    grid-template-columns: 1fr;
    gap: 1rem;
  }
}
</style>