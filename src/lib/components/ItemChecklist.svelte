<script lang="ts">
    export let items: { id: string; name: string; status: 'present' | 'not_present' }[] = [];
    export let selectedIds: string[] = [];
    export let disabled: boolean = false;
    export let showStatus: boolean = false;

    // New-style parent callback prop, not Svelte event
    export let onChange: (ids: string[]) => void = () => {};

    function toggle(id: string) {
        let next: string[];
        if (selectedIds.includes(id)) {
            next = selectedIds.filter(x => x !== id);
        } else {
            next = [...selectedIds, id];
        }
        onChange(next);
    }
</script>

<div class="item-checklist">
    {#if items.length === 0}
        <div style="color:#888;">No items defined for this project.</div>
    {:else}
        <ul style="list-style:none;padding:0;margin:0;">
            {#each items as item}
                <li style="margin:0.3em 0; display:flex; align-items:center; gap:0.7em;">
                    <input
                        type="checkbox"
                        checked={selectedIds.includes(item.id)}
                        on:change={() => toggle(item.id)}
                        disabled={disabled}
                        id={"itemcheck-" + item.id}
                    />
                    <label for={"itemcheck-" + item.id}>
                        {#if showStatus}
                            <span style="display:inline-block; width:1em; height:1em; border-radius:50%; margin-right:0.5em;
                                background:{item.status === 'present' ? '#47e37a' : '#e74c3c'};
                                border:1px solid #aaa; vertical-align:middle;">
                            </span>
                        {/if}
                        {item.name}
                    </label>
                </li>
            {/each}
        </ul>
    {/if}
</div>
