<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { ruleset as rulesetStore, gmMode, view } from '../stores';
  import { get } from 'svelte/store';
  import Modal from './Modal.svelte';

  const dispatch = createEventDispatcher();
  let password = '';
  let error = false;

  function submit() {
    if (password === get(rulesetStore).password) {
      gmMode.set(true);
      view.set('admin');
      dispatch('close');
    } else {
      error = true;
    }
  }
</script>

<Modal title="GM Access" on:close={() => dispatch('close')}>
  <p class="muted">
    Enter the GM password to unlock the admin panel. This is a soft gate — on a static site the
    rules ship to every browser, so it only keeps honest players out.
  </p>
  <form on:submit|preventDefault={submit} class="col">
    <input
      type="password"
      placeholder="Password"
      bind:value={password}
      on:input={() => (error = false)}
      autofocus
    />
    {#if error}<span class="err">Incorrect password.</span>{/if}
  </form>
  <svelte:fragment slot="footer">
    <button class="ghost" on:click={() => dispatch('close')}>Cancel</button>
    <button class="primary" on:click={submit}>Unlock</button>
  </svelte:fragment>
</Modal>

<style>
  .err {
    color: var(--bad);
    font-size: 0.85em;
  }
</style>
