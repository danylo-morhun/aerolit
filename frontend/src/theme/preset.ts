import { definePreset } from '@primeuix/themes';
import Aura from '@primeuix/themes/aura';

/**
 * PrimeVue preset — the bridge between the design tokens in `tokens.css` and
 * every PrimeVue component.
 *
 * The values here are deliberately `var(--aq-*)` references rather than literal
 * colours. Those variables are already re-pointed for dark mode by the `.dark`
 * block in `tokens.css`, so one definition covers both themes: PrimeVue emits
 * the variable reference, the browser resolves it under whichever theme is
 * active. That keeps a single edit point for a colour change — the alternative
 * (literal values duplicated across `colorScheme.light` / `.dark`) would mean
 * two places to edit and two chances to drift.
 */
export const AerolitPreset = definePreset(Aura, {
  semantic: {
    transitionDuration: '150ms',
    focusRing: {
      width: '2px',
      style: 'solid',
      color: 'var(--aq-accent)',
      offset: '2px',
    },
    // PrimeVue expects a full ramp; the app only ever uses `primary.color`,
    // so the ramp collapses onto the accent role with a darker hover step.
    primary: {
      50: 'var(--aq-accent)',
      100: 'var(--aq-accent)',
      200: 'var(--aq-accent)',
      300: 'var(--aq-accent)',
      400: 'var(--aq-accent)',
      500: 'var(--aq-accent)',
      600: 'var(--aq-accent-hover)',
      700: 'var(--aq-accent-hover)',
      800: 'var(--aq-accent-hover)',
      900: 'var(--aq-accent-hover)',
      950: 'var(--aq-accent-hover)',
    },
    colorScheme: {
      light: {
        primary: {
          color: 'var(--aq-accent)',
          contrastColor: 'var(--aq-accent-contrast)',
          hoverColor: 'var(--aq-accent-hover)',
          activeColor: 'var(--aq-accent-hover)',
        },
        highlight: {
          background: 'color-mix(in srgb, var(--aq-accent) 12%, transparent)',
          focusBackground: 'color-mix(in srgb, var(--aq-accent) 18%, transparent)',
          color: 'var(--aq-accent)',
          focusColor: 'var(--aq-accent)',
        },
        text: {
          color: 'var(--aq-ink)',
          hoverColor: 'var(--aq-ink)',
          mutedColor: 'var(--aq-ink-muted)',
          hoverMutedColor: 'var(--aq-ink)',
        },
        content: {
          background: 'var(--aq-surface)',
          hoverBackground: 'var(--aq-surface-sunken)',
          borderColor: 'var(--aq-border)',
          color: 'var(--aq-ink)',
          hoverColor: 'var(--aq-ink)',
        },
        overlay: {
          select: {
            background: 'var(--aq-surface)',
            borderColor: 'var(--aq-border)',
            color: 'var(--aq-ink)',
          },
          popover: {
            background: 'var(--aq-surface)',
            borderColor: 'var(--aq-border)',
            color: 'var(--aq-ink)',
          },
          modal: {
            background: 'var(--aq-surface)',
            borderColor: 'var(--aq-border)',
            color: 'var(--aq-ink)',
          },
        },
        formField: {
          background: 'var(--aq-surface-input)',
          disabledBackground: 'var(--aq-surface-sunken)',
          filledBackground: 'var(--aq-surface-sunken)',
          borderColor: 'var(--aq-border)',
          hoverBorderColor: 'var(--aq-border-strong)',
          focusBorderColor: 'var(--aq-accent)',
          color: 'var(--aq-ink)',
          disabledColor: 'var(--aq-ink-subtle)',
          placeholderColor: 'var(--aq-ink-subtle)',
          iconColor: 'var(--aq-ink-subtle)',
        },
        list: {
          option: {
            focusBackground: 'var(--aq-surface-sunken)',
            selectedBackground: 'color-mix(in srgb, var(--aq-accent) 12%, transparent)',
            color: 'var(--aq-ink)',
            focusColor: 'var(--aq-ink)',
            selectedColor: 'var(--aq-accent)',
          },
        },
        navigation: {
          item: {
            focusBackground: 'var(--aq-surface-sunken)',
            activeBackground: 'var(--aq-surface-sunken)',
            color: 'var(--aq-ink-muted)',
            focusColor: 'var(--aq-ink)',
            activeColor: 'var(--aq-ink)',
          },
        },
      },
    },
  },

  /**
   * Component-level tokens.
   *
   * These live in the preset rather than as `.p-datatable-*` rules inside the
   * component that happens to render a table. That is the difference the brief
   * draws between "theming comes from one set of tokens" and "per-view
   * overrides": a second table added tomorrow inherits this without copying a
   * style block, and there is one place to change when the row rhythm changes.
   */
  components: {
    datatable: {
      headerCell: {
        background: 'var(--aq-surface)',
        color: 'var(--aq-ink-muted)',
        borderColor: 'var(--aq-border)',
        padding: '1rem',
      },
      bodyCell: {
        borderColor: 'var(--aq-border)',
        padding: '1rem',
      },
      row: {
        background: 'var(--aq-surface)',
        color: 'var(--aq-ink)',
        hoverBackground: 'var(--aq-surface-sunken)',
        hoverColor: 'var(--aq-ink)',
      },
    },
  },
});

/**
 * Passed to `PrimeVue` at install time. `.dark` on <html> is the one signal the
 * whole interface listens to — PrimeVue components, the tokens above, the chart
 * palette and the map's basemap all key off it.
 *
 * `cssLayer` puts PrimeVue's rules in a named layer ordered before `app`, so
 * project styles override component styles by layer order instead of by
 * selector-specificity tricks.
 */
export const themeOptions = {
  preset: AerolitPreset,
  options: {
    darkModeSelector: '.dark',
    cssLayer: {
      name: 'primevue',
      order: 'reset, primevue, app',
    },
  },
} as const;
