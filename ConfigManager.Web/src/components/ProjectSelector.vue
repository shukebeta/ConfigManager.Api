<template>
  <div class="project-selector">
    <div class="selector-header">
      <h2>Select Project</h2>
      <button @click="refreshProjects" :disabled="loading" class="refresh-btn">
        <span v-if="loading">Loading...</span>
        <span v-else>Refresh</span>
      </button>
    </div>

    <div v-if="error" class="error-message">
      <p>{{ error }}</p>
      <button @click="clearError" class="error-dismiss">Dismiss</button>
    </div>

    <div v-if="!hasProjects && !loading" class="no-projects">
      <p>No projects found. Make sure the API is running and Redis contains project data.</p>
    </div>

    <div v-if="hasProjects" class="projects-grid">
      <button
        v-for="project in projects"
        :key="project"
        @click="selectProject(project)"
        :class="[
          'project-card',
          { 'selected': selectedProject === project }
        ]"
      >
        <h3>{{ project }}</h3>
        <span v-if="selectedProject === project" class="selected-indicator">✓</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useProjectsStore } from '@/stores/projects'

const projectsStore = useProjectsStore()
const { projects, selectedProject, loading, error, hasProjects } = storeToRefs(projectsStore)
const { fetchProjects, selectProject, clearError } = projectsStore

const refreshProjects = async () => {
  await fetchProjects()
}

onMounted(() => {
  fetchProjects()
})
</script>

<style scoped>
.project-selector {
  padding: 1.5rem;
  max-width: 800px;
  margin: 0 auto;
}

.selector-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.selector-header h2 {
  margin: 0;
  color: var(--color-heading);
}

.refresh-btn {
  padding: 0.5rem 1rem;
  background: var(--color-background-mute);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.refresh-btn:hover:not(:disabled) {
  background: var(--color-background-soft);
}

.refresh-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.error-message {
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 4px;
  padding: 1rem;
  margin-bottom: 1.5rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.error-message p {
  margin: 0;
  color: #dc2626;
}

.error-dismiss {
  background: transparent;
  border: none;
  color: #dc2626;
  cursor: pointer;
  text-decoration: underline;
}

.no-projects {
  text-align: center;
  padding: 2rem;
  color: var(--color-text-2);
}

.projects-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 1rem;
}

.project-card {
  position: relative;
  background: var(--color-background-soft);
  border: 2px solid var(--color-border);
  border-radius: 8px;
  padding: 1.5rem 1rem;
  cursor: pointer;
  transition: all 0.2s;
  text-align: left;
  min-height: 80px;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.project-card:hover {
  border-color: var(--color-border-hover);
  background: var(--color-background-mute);
}

.project-card.selected {
  border-color: #10b981;
  background: #f0fdf4;
}

.project-card h3 {
  margin: 0;
  font-size: 1.1rem;
  color: var(--color-heading);
  word-break: break-word;
}

.selected-indicator {
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  color: #10b981;
  font-weight: bold;
  font-size: 1.2rem;
}
</style>