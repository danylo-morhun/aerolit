<script setup lang="ts">
import IconField from 'primevue/iconfield';
import InputIcon from 'primevue/inputicon';
import InputText from 'primevue/inputtext';
import { useId } from 'vue';

/**
 * The header lookup field.
 *
 * Updates on every keystroke rather than debouncing: the filter runs against
 * an in-memory list of 240 stations, so there is no request to throttle and a
 * debounce would only add latency between typing and seeing the result. If
 * this ever queried the server, the debounce belongs in the query layer, not
 * here.
 */
withDefaults(
  defineProps<{
    placeholder?: string;
    /** Visible label is omitted in the mockup; this names the field for AT. */
    ariaLabel?: string;
  }>(),
  {
    placeholder: 'Search districts or sensor IDs..',
    ariaLabel: 'Search districts or sensor IDs',
  },
);

const model = defineModel<string>({ default: '' });
const inputId = useId();
</script>

<template>
  <div class="search">
    <label class="sr-only" :for="inputId">{{ ariaLabel }}</label>
    <IconField>
      <InputIcon class="pi pi-search" />
      <InputText
        :id="inputId"
        v-model="model"
        class="search__input"
        type="search"
        autocomplete="off"
        :placeholder="placeholder"
      />
    </IconField>
  </div>
</template>

<style scoped>
.search {
  width: 100%;
  max-width: 320px;
}

.search :deep(.p-iconfield) {
  width: 100%;
}

.search__input {
  width: 100%;
  padding: 10px 14px 10px 38px;
  font-size: var(--aq-text-base);
  background: var(--aq-surface-input);
  border: 1px solid var(--aq-border);
  border-radius: var(--aq-radius-pill);
}

.search :deep(.p-inputicon) {
  left: 14px;
  color: var(--aq-ink-subtle);
}

/* The native clear affordance on type=search is inconsistent across engines
   and unstyleable in WebKit; the field is short enough to clear by hand. */
.search__input::-webkit-search-cancel-button {
  appearance: none;
}
</style>
