# {{PROJECT_NAME}} Reference

Complete technical reference for {{PROJECT_NAME}}.

---

## Commands

### [command-name]

[One-line description of what this command does]

#### Synopsis

```
[command] [subcommand] [options] [arguments]
```

#### Description

[Detailed description explaining:
- What the command does
- When to use it
- How it relates to other commands]

#### Arguments

| Argument | Required | Description |
|----------|----------|-------------|
| `<required-arg>` | Yes | [description] |
| `[optional-arg]` | No | [description with default] |

#### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `-s, --short` | boolean | `false` | [description] |
| `-v, --value <val>` | string | `"default"` | [description] |
| `--flag` | boolean | `false` | [description] |

#### Environment Variables

| Variable | Description |
|----------|-------------|
| `VAR_NAME` | [overrides option X] |

#### Exit Codes

| Code | Meaning |
|------|---------|
| `0` | Success |
| `1` | [error condition] |
| `2` | [another error condition] |

#### Examples

**Basic usage:**
```bash
[command] [basic-args]
```

**With options:**
```bash
[command] --option value [args]
```

**Advanced example:**
```bash
# [Description of what this example shows]
[command] --flag -v "value" <arg>
```

#### See Also

- [`[related-command-1]`](#related-command-1)
- [`[related-command-2]`](#related-command-2)

---

### [another-command]

[Follow same pattern for each command]

---

## API Reference

### Functions

#### `functionName(param1, param2)`

[One-line description]

**Signature:**
```typescript
function functionName(
  param1: Type1,
  param2?: Type2
): ReturnType
```

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `param1` | `Type1` | Yes | [description] |
| `param2` | `Type2` | No | [description, default: value] |

**Returns:**

`ReturnType` - [description of what is returned]

**Throws:**

| Error | Condition |
|-------|-----------|
| `ErrorType1` | [when this is thrown] |
| `ErrorType2` | [when this is thrown] |

**Example:**
```typescript
import { functionName } from '{{package}}';

const result = functionName('value1', { option: true });
console.log(result);
// Output: [expected output]
```

---

#### `anotherFunction()`

[Follow same pattern]

---

### Classes

#### `ClassName`

[Description of what this class represents and when to use it]

**Constructor:**
```typescript
new ClassName(options?: ClassOptions)
```

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `options` | `ClassOptions` | No | [description] |

**Properties:**

| Property | Type | Description |
|----------|------|-------------|
| `property1` | `Type` | [description] |
| `property2` | `Type` | [description, read-only] |

**Methods:**

##### `methodName(param)`

[Description]

```typescript
methodName(param: Type): ReturnType
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `param` | `Type` | [description] |

**Returns:** `ReturnType`

**Example:**
```typescript
const instance = new ClassName();
const result = instance.methodName('value');
```

---

### Interfaces

#### `InterfaceName`

[Description of what this interface represents]

```typescript
interface InterfaceName {
  requiredProp: string;
  optionalProp?: number;
  callback: (value: Type) => void;
}
```

**Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `requiredProp` | `string` | Yes | [description] |
| `optionalProp` | `number` | No | [description, default: value] |
| `callback` | `(value: Type) => void` | Yes | [description] |

---

## Configuration

### Configuration File

{{PROJECT_NAME}} reads configuration from `[config-file-name]`.

**Location search order:**
1. `./[config-file]`
2. `~/.config/{{package}}/[config-file]`
3. Default values

**Full schema:**
```yaml
# [config-file-name]
# {{PROJECT_NAME}} Configuration

# [Section description]
section:
  # [Option description]
  # Type: string
  # Default: "value"
  option1: "value"

  # [Option description]
  # Type: boolean
  # Default: false
  option2: false

  # [Option description]
  # Type: array
  # Default: []
  items:
    - item1
    - item2

# [Another section]
another_section:
  nested:
    # [Description]
    deep_option: value
```

### Configuration Options

#### `section.option1`

- **Type:** `string`
- **Required:** No
- **Default:** `"value"`
- **Environment:** `{{PROJECT}}_OPTION1`

[Detailed description of what this option controls]

**Example:**
```yaml
section:
  option1: "custom-value"
```

---

#### `section.option2`

[Follow same pattern for each option]

---

## Environment Variables

All configuration options can be set via environment variables.

| Variable | Config Equivalent | Description |
|----------|-------------------|-------------|
| `{{PROJECT}}_CONFIG` | N/A | Path to config file |
| `{{PROJECT}}_OPTION1` | `section.option1` | [description] |
| `{{PROJECT}}_DEBUG` | `debug` | Enable debug logging |

**Precedence:** Environment variables override config file values.

---

## File Formats

### [file-type.ext]

[Description of this file format]

**Schema:**
```yaml
# Required fields
required_field: Type  # [description]

# Optional fields
optional_field?: Type  # [description, default: value]

# Nested structure
nested:
  field: Type
```

**Example:**
```yaml
required_field: "example"
optional_field: 42

nested:
  field: true
```

**Validation:**
- `required_field` must be [constraint]
- `optional_field` must be [constraint]

---

## Error Codes

### Error Reference

| Code | Name | Description | Resolution |
|------|------|-------------|------------|
| `E001` | `[ErrorName]` | [when this occurs] | [how to fix] |
| `E002` | `[ErrorName]` | [description] | [resolution] |

### Error Messages

#### `E001: [Error message]`

**Cause:** [detailed explanation]

**Solution:**
```bash
[fix commands]
```

---

## Glossary

| Term | Definition |
|------|------------|
| **[Term 1]** | [definition] |
| **[Term 2]** | [definition] |
| **[Term 3]** | [definition] |

---

## Version History

See [CHANGELOG.md](../CHANGELOG.md) for detailed version history.

| Version | Date | Notable Changes |
|---------|------|-----------------|
| v1.0.0 | YYYY-MM-DD | Initial release |
| v1.1.0 | YYYY-MM-DD | Added [feature] |
