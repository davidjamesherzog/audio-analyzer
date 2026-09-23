// @vitest-environment happy-dom

import { mount } from '@vue/test-utils'
import { describe, expect, test } from 'vitest'

import MainLayout from './MainLayout.vue'

function mountLayout() {
  return mount(MainLayout, {
    global: {
      stubs: {
        QLayout: {
          name: 'QLayout',
          props: ['view'],
          template: '<div class="q-layout"><slot /></div>',
        },
        QHeader: {
          name: 'QHeader',
          props: { elevated: Boolean },
          template: '<header class="q-header"><slot /></header>',
        },
        QToolbar: { template: '<div class="q-toolbar"><slot /></div>' },
        QToolbarTitle: { template: '<div class="q-toolbar-title"><slot /></div>' },
        QPageContainer: { template: '<main class="q-page-container"><slot /></main>' },
        RouterView: {
          name: 'RouterView',
          template: '<div data-testid="router-view">Rendered page</div>',
        },
      },
    },
  })
}

describe('MainLayout', () => {
  test('uses the expected Quasar layout and elevated application header', () => {
    const wrapper = mountLayout()

    expect(wrapper.getComponent({ name: 'QLayout' }).props('view')).toBe('lHh Lpr lFf')
    expect(wrapper.getComponent({ name: 'QHeader' }).props('elevated')).toBe(true)
    expect(wrapper.find('[data-testid="app-header"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="app-toolbar"]').exists()).toBe(true)
  })

  test('renders the application title and descriptive subtitle', () => {
    const wrapper = mountLayout()
    expect(wrapper.get('[data-testid="app-title"]').text()).toBe('Audio Analyzer')
    expect(wrapper.get('[data-testid="app-subtitle"]').text()).toBe(
      'Open a local file and inspect decoded signal metrics',
    )
  })

  test('renders the active route inside the page container', () => {
    const wrapper = mountLayout()
    const pageContainer = wrapper.get('[data-testid="page-container"]')

    expect(pageContainer.findComponent({ name: 'RouterView' }).exists()).toBe(true)
    expect(pageContainer.get('[data-testid="router-view"]').text()).toBe('Rendered page')
  })
})
