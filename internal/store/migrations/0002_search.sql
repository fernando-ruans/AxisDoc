CREATE VIRTUAL TABLE IF NOT EXISTS search_index USING fts5(
    doc_id UNINDEXED,
    path UNINDEXED,
    title,
    content,
    tokenize = 'unicode61 remove_diacritics 2'
);
