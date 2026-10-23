// T512, B515: Input box > Pictures: its states, the parts modules draw them
import type { Meta, StoryObj } from '@storybook/react-vite'
import * as InputBox from '../parts/InputBox'

const meta: Meta = { title: 'Components/Input box/Pictures' }
export default meta

export const WithPictures: StoryObj = { ...InputBox.WithPictures, name: 'Two pictures' }
export const PictureUploading: StoryObj = { ...InputBox.PictureUploading, name: 'Uploading' }
export const PictureFailed: StoryObj = { ...InputBox.PictureFailed, name: 'Upload failed' }
