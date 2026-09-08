// Package runtimei define abstrações de interação com o sistema,
// permitindo testar services sem o runtime do Wails.
package runtimei

// Dialogs abstrai diálogos nativos de arquivos.
type Dialogs interface {
	// OpenFiles abre o seletor de múltiplos arquivos.
	OpenFiles() ([]string, error)
	// OpenFolder abre o seletor de pasta.
	OpenFolder() (string, error)
	// SaveFile abre o diálogo de salvar com nome sugerido.
	SaveFile(defaultName string) (string, error)
}

// Notifier notifica o usuário (toast/notificação nativa).
type Notifier interface {
	// Notify envia uma notificação com título e corpo.
	Notify(title, body string) error
}

// Emitter emite eventos para o frontend.
type Emitter interface {
	// Emit envia um evento nomeado com payload arbitrário.
	Emit(event string, data any)
}
