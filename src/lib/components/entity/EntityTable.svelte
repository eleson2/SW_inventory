<script lang="ts" generics="T extends Record<string, any>">
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { Checkbox } from '$lib/components/ui/checkbox';
  import * as Table from '$lib/components/ui/table';
  import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
  import { Search, Plus, Trash2, Copy, MoreVertical, Edit } from 'lucide-svelte';
  
  type Column<T> = {
    key: string;
    label: string;
    render?: (item: T) => any;
    class?: string;
  };
  
  type Props = {
    items: T[];
    columns: Column<T>[];
    idField: string;
    searchFields?: string[];
    searchPlaceholder?: string;
    onCreateClick?: () => void;
    onEditClick?: (item: T) => void;
    onCloneClick?: (item: T) => void;
    onDeleteClick?: (items: T[]) => void;
    createLabel?: string;
    showSelection?: boolean;
    showClone?: boolean;
    showDelete?: boolean;
    showActions?: boolean;
    emptyMessage?: string;
    filterSlot?: any;
    actionSlot?: any;
  };
  
  let {
    items,
    columns,
    idField,
    searchFields = [],
    searchPlaceholder = 'Search...',
    onCreateClick,
    onEditClick,
    onCloneClick,
    onDeleteClick,
    createLabel = 'Create New',
    showSelection = true,
    showClone = true,
    showDelete = true,
    showActions = true,
    emptyMessage,
    filterSlot,
    actionSlot
  }: Props = $props();
  
  let searchTerm = $state('');
  let selectedIds = $state<Set<any>>(new Set());
  
  const filteredItems = $derived(
    items.filter(item => {
      if (!searchTerm || searchFields.length === 0) return true;
      const search = searchTerm.toLowerCase();
      return searchFields.some(field => {
        const value = field.split('.').reduce((obj, key) => obj?.[key], item);
        return String(value || '').toLowerCase().includes(search);
      });
    })
  );
  
  const selectedItems = $derived(
    items.filter(item => selectedIds.has(item[idField]))
  );
  
  const allSelected = $derived(
    filteredItems.length > 0 && 
    filteredItems.every(item => selectedIds.has(item[idField]))
  );
  
  function toggleAll() {
    if (allSelected) {
      selectedIds = new Set();
    } else {
      selectedIds = new Set(filteredItems.map(item => item[idField]));
    }
  }
  
  function toggleItem(id: any) {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    selectedIds = newSet;
  }
</script>

<div class="space-y-4">
  <!-- Toolbar -->
  <div class="flex items-center justify-between gap-4 flex-wrap">
    <div class="flex items-center gap-2 flex-1 min-w-0 flex-wrap">
      {#if searchFields.length > 0}
        <div class="relative flex-1 max-w-sm min-w-[200px]">
          <Search class="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder={searchPlaceholder}
            bind:value={searchTerm}
            class="pl-8"
          />
        </div>
      {/if}
      
      {#if filterSlot}
        {@render filterSlot()}
      {/if}
      
      {#if actionSlot}
        {@render actionSlot({ selectedIds, selectedItems })}
      {/if}
      
      {#if showClone && selectedIds.size === 1 && onCloneClick}
        <Button
          variant="outline"
          size="sm"
          onclick={() => {
            const [id] = Array.from(selectedIds);
            const item = items.find(i => i[idField] === id);
            if (item) onCloneClick(item);
          }}
        >
          <Copy class="h-4 w-4 mr-2" />
          Clone
        </Button>
      {/if}
      
      {#if showDelete && selectedIds.size > 0 && onDeleteClick}
        <Button
          variant="destructive"
          size="sm"
          onclick={() => onDeleteClick(selectedItems)}
        >
          <Trash2 class="h-4 w-4 mr-2" />
          Delete ({selectedIds.size})
        </Button>
      {/if}
    </div>
    
    {#if onCreateClick}
      <Button onclick={onCreateClick}>
        <Plus class="h-4 w-4 mr-2" />
        {createLabel}
      </Button>
    {/if}
  </div>
  
  <!-- Results count -->
  <div class="text-sm text-muted-foreground">
    Showing {filteredItems.length} of {items.length} item{items.length !== 1 ? 's' : ''}
  </div>
  
  <!-- Table -->
  <div class="rounded-md border">
    <Table.Root>
      <Table.Header>
        <Table.Row>
          {#if showSelection}
            <Table.Head class="w-12">
              <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
            </Table.Head>
          {/if}
          {#each columns as column}
            <Table.Head class={column.class || ''}>{column.label}</Table.Head>
          {/each}
          {#if showActions && (onEditClick || onCloneClick || onDeleteClick)}
            <Table.Head class="w-12"></Table.Head>
          {/if}
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {#if filteredItems.length === 0}
          <Table.Row>
            <Table.Cell 
              colspan={columns.length + (showSelection ? 1 : 0) + (showActions ? 1 : 0)} 
              class="text-center text-muted-foreground py-8"
            >
              {emptyMessage || (searchTerm ? 'No items found matching your search' : 'No items yet')}
            </Table.Cell>
          </Table.Row>
        {:else}
          {#each filteredItems as item (item[idField])}
            <Table.Row 
              class="cursor-pointer hover:bg-muted/50"
              ondblclick={() => onEditClick?.(item)}
            >
              {#if showSelection}
                <Table.Cell onclick={(e) => e.stopPropagation()}>
                  <Checkbox 
                    checked={selectedIds.has(item[idField])}
                    onCheckedChange={() => toggleItem(item[idField])}
                  />
                </Table.Cell>
              {/if}
              {#each columns as column}
                <Table.Cell class={column.class || ''}>
                  {#if column.render}
                    {@render column.render(item)}
                  {:else}
                    {column.key.split('.').reduce((obj, key) => obj?.[key], item) || '—'}
                  {/if}
                </Table.Cell>
              {/each}
              {#if showActions && (onEditClick || onCloneClick || onDeleteClick)}
                <Table.Cell onclick={(e) => e.stopPropagation()}>
                  <DropdownMenu.Root>
                    <DropdownMenu.Trigger asChild let:builder>
                      <Button builders={[builder]} variant="ghost" size="icon">
                        <MoreVertical class="h-4 w-4" />
                      </Button>
                    </DropdownMenu.Trigger>
                    <DropdownMenu.Content align="end">
                      {#if onEditClick}
                        <DropdownMenu.Item onclick={() => onEditClick(item)}>
                          <Edit class="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenu.Item>
                      {/if}
                      {#if showClone && onCloneClick}
                        <DropdownMenu.Item onclick={() => onCloneClick(item)}>
                          <Copy class="h-4 w-4 mr-2" />
                          Clone
                        </DropdownMenu.Item>
                      {/if}
                      {#if showDelete && onDeleteClick}
                        <DropdownMenu.Separator />
                        <DropdownMenu.Item 
                          onclick={() => onDeleteClick([item])}
                          class="text-destructive"
                        >
                          <Trash2 class="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenu.Item>
                      {/if}
                    </DropdownMenu.Content>
                  </DropdownMenu.Root>
                </Table.Cell>
              {/if}
            </Table.Row>
          {/each}
        {/if}
      </Table.Body>
    </Table.Root>
  </div>
</div>
