<template>
  <q-layout data-testid="main-layout" view="lHh Lpr lFf">
    <q-header data-testid="app-header" class="app-header" elevated>
      <q-toolbar data-testid="app-toolbar" class="app-toolbar">
        <q-toolbar-title data-testid="app-title-container" class="app-toolbar__title">
          <span data-testid="app-title">Audio Analyzer</span>
          <small data-testid="app-subtitle"
            >Open a local file and inspect decoded signal metrics</small
          >
        </q-toolbar-title>
      </q-toolbar>
    </q-header>

    <q-page-container data-testid="page-container">
      <router-view />
    </q-page-container>
  </q-layout>
</template>
