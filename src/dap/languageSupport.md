# DAP Language Support Roadmap

## Current Support
- **JavaScript** ✅ - Native support through Node.js inspector
- **TypeScript** ✅ - Support via ts-blank-space transformation

## Planned Language Support

### High Priority (Popular DAP-compatible languages)
1. **Python**
   - Adapter: `debugpy`
   - Installation: `pip install debugpy`
   - Detection: `.py` files, `requirements.txt`, `pyproject.toml`
   - Special considerations: Virtual environments, Python version

2. **Go**
   - Adapter: `dlv` (Delve)
   - Installation: `go install github.com/go-delve/delve/cmd/dlv@latest`
   - Detection: `.go` files, `go.mod`
   - Special considerations: GOPATH, module mode

3. **Java**
   - Adapter: `java-debug` (Microsoft)
   - Installation: VSCode extension or standalone
   - Detection: `.java` files, `pom.xml`, `build.gradle`
   - Special considerations: Classpath, JDK version

### Medium Priority
4. **C/C++**
   - Adapter: `gdb` or `lldb`
   - Installation: System package manager
   - Detection: `.c`, `.cpp`, `.h` files, `Makefile`, `CMakeLists.txt`
   - Special considerations: Compiler flags, debug symbols

5. **Rust**
   - Adapter: `rust-analyzer` or `lldb`/`gdb`
   - Installation: `rustup component add rust-analyzer`
   - Detection: `.rs` files, `Cargo.toml`
   - Special considerations: Cargo workspace, target directory

6. **C#/.NET**
   - Adapter: `netcoredbg`
   - Installation: Download from GitHub releases
   - Detection: `.cs` files, `.csproj`, `.sln`
   - Special considerations: .NET version, project type

### Low Priority
7. **Ruby**
   - Adapter: `ruby-debug-ide`
   - Installation: `gem install ruby-debug-ide`
   - Detection: `.rb` files, `Gemfile`
   - Special considerations: Ruby version, bundler

8. **PHP**
   - Adapter: `xdebug` with DAP bridge
   - Installation: PHP extension + DAP adapter
   - Detection: `.php` files, `composer.json`
   - Special considerations: PHP version, web server integration

9. **Swift**
   - Adapter: `lldb` with Swift support
   - Installation: Xcode or Swift toolchain
   - Detection: `.swift` files, `Package.swift`
   - Special considerations: Platform-specific (macOS/Linux)

## Implementation Plan

### Phase 1: Core Infrastructure
- [x] Abstract adapter resolution
- [x] Language detection framework
- [x] TypeScript support (ts-blank-space)
- [ ] Language-specific configuration

### Phase 2: Popular Languages
- [ ] Python support
- [ ] Go support
- [ ] Java support

### Phase 3: System Languages
- [ ] C/C++ support
- [ ] Rust support
- [ ] C#/.NET support

### Phase 4: Dynamic Languages
- [ ] Ruby support
- [ ] PHP support
- [ ] Swift support

## Technical Considerations

1. **Adapter Discovery**
   - Check if adapter is installed
   - Provide installation instructions
   - Auto-install where possible

2. **Configuration Generation**
   - Language-specific launch configs
   - Environment setup (PATH, env vars)
   - Build system integration

3. **Source Mapping**
   - Handle compiled languages
   - Support for source maps
   - Preprocessor handling

4. **Platform Support**
   - Cross-platform adapter availability
   - Platform-specific configurations
   - Docker/container debugging